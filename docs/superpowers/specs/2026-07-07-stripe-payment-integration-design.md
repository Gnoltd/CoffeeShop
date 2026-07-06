# Stripe Payment Integration — Design Spec

**Date:** 2026-07-07
**Status:** Approved, ready for implementation planning.

## Context

Deferred follow-up from the Orders Realtime spec
(`docs/superpowers/specs/2026-07-06-orders-realtime-design.md`), which
explicitly scoped Stripe/VNPay out: "the user wants all three payment
methods real and usable... agreed sequencing: Orders core (Cash) → a
Stripe spec → a VNPay spec." This is that Stripe spec. Cash is fully
real end-to-end today; Checkout's Card button and POS's Card button are
both `disabled` + tooltip.

### What already exists

- `place_order` RPC (migration `0014_orders_place_and_track_fns.sql`,
  `security definer`) — the only place order money values are computed.
  Always inserts at `status='pending_payment'`, `payment_status='pending'`,
  then does a genuine second `update` to `'paid'` when
  `paymentCollected: true` is passed (the POS-charge case) — required
  because `handle_order_paid` (migration `0007`) is a `before update`
  trigger and cannot fire on `insert`. Returns `{ orderId, total }`.
- `handle_order_paid` trigger — fires when `payment_status` transitions
  to `'paid'` (`old is distinct from 'paid'` guard, so re-firing the same
  transition twice is a no-op). Deducts inventory via
  `menu_item_ingredients`/`modifier_ingredients` and awards loyalty
  points. **This spec adds no new inventory/loyalty logic — any code
  path that flips `payment_status` to `'paid'` gets both for free.**
- `place-order` Edge Function — a thin wrapper calling `place_order` with
  the service-role key, already documented as "shaped so a future
  Stripe/VNPay pass can wrap a gateway call around this same call
  without re-architecting anything here." This spec is that pass.
- `payment_method` enum: `'stripe' | 'cash' | 'vnpay'` — note there is no
  separate `'card'` value; `'stripe'` is the enum's existing name for
  "card," used both for a real online Stripe charge and for an
  in-person POS card-terminal charge (see POS section below), the same
  way `'cash'` already covers both self-checkout pay-at-pickup and
  POS-collected cash.
- `stripe-webhook` Edge Function — currently a one-line comment stub.
- Env vars already synced to Vercel: `STRIPE_SECRET_KEY` (confirmed a
  **test-mode** key — `sk_test_...` — so this can be built and verified
  end-to-end with Stripe's test cards before any live-key swap),
  `NEXT_PUBLIC_SITE_URL`. `STRIPE_WEBHOOK_SECRET` is currently empty.

### Why Stripe Checkout (hosted), not embedded Elements

Chosen over embedded Stripe Elements: no PCI scope, no client-side card
form, Stripe handles 3D Secure/localization/retries automatically. The
cost (leaving the app briefly) is acceptable for a single-location shop;
embedded Elements would mean building and maintaining a PaymentIntent
confirmation flow in-page for marginal UX gain.

### Pending-order lifecycle concerns (raised during brainstorming, addressed below)

Since `place_order` already always inserts at `pending_payment`/`pending`
before payment is confirmed (true for Cash today too), a Stripe order
exists in the DB before the customer has actually paid. Two concerns
were raised and resolved:

1. **Abandoned/expired sessions cluttering the DB.** A pending order
   doesn't reserve any real resource — `handle_order_paid` (and thus
   inventory deduction) only fires on the transition to `'paid'`, so a
   stuck pending row is inert clutter, not a stock lock. Resolved by
   auto-cancelling on Stripe's `checkout.session.expired` webhook event,
   using Stripe's shortest allowed session lifetime (30 minutes) instead
   of the 24-hour default.
2. **Redirect latency and "I want to change payment method" friction.**
   Resolved two ways: (a) the browser makes exactly one network call
   before redirecting (see "combined call" below, not a
   place-order-then-separately-create-session round trip), and (b) an
   explicit self-cancel path (below) lets a customer who backs out of
   Stripe's page immediately free up their cart to retry with Cash,
   rather than waiting on the 30-minute expiry.

## Scope

**In scope:**
- Customer self-checkout `/checkout` Card button → real Stripe Checkout
  Session, redirect, webhook-confirmed payment.
- POS "Card" button → marks an order paid immediately, no Stripe API
  call (money was already collected via a physical card terminal outside
  this app — see POS section).
- Self-cancel of an abandoned Stripe checkout, and auto-cancel of a
  truly-abandoned (no interaction) session after 30 minutes.

**Explicitly out of scope (documented, not hidden):**
- Refunds/disputes/chargebacks — handled manually via the Stripe
  Dashboard for now.
- Stripe Terminal (an actual in-person Stripe-processed card reader
  integration) — POS's "Card" stays a manual "already collected
  externally" flag, not a real charge. A future project if the shop
  wants Stripe to process in-person cards directly.
- VNPay — its own separate, still-pending follow-up spec, unaffected by
  this work.

## Design

### 1. `place-order` Edge Function (extended, not replaced)

After the existing `place_order` RPC call succeeds, branch on the
payload:

- `paymentMethod: 'cash'`, or `paymentMethod: 'stripe'` with
  `paymentCollected: true` (POS card) → **unchanged**, returns
  `{ orderId, total }` exactly as today.
- `paymentMethod: 'stripe'` with `paymentCollected: false` (customer
  self-checkout) → additionally creates a Stripe Checkout Session:
  - One `line_item` for the order's real `total` (from `place_order`'s
    return value, never a client-supplied number) in `currency: 'vnd'`.
    **VND is a Stripe zero-decimal currency** — the integer total is
    passed to Stripe as-is, not multiplied by 100 (the standard
    USD-cents mistake would 100x every VND charge).
  - `metadata.order_id = orderId` — how the webhook finds the row.
  - `success_url` / `cancel_url` built **server-side** from the
    `NEXT_PUBLIC_SITE_URL` env var plus a `locale` field on the payload
    (validated against `'vi' | 'en'`, rejected otherwise) — never taken
    as a raw URL from the client. Accepting a client-supplied redirect
    target here would be an open-redirect vector on a payment flow.
    - `success_url`: `{site}/{locale}/orders/{orderId}?table=...` (reuses
      the existing Order Tracking route/params untouched).
    - `cancel_url`: `{site}/{locale}/checkout?stripeCanceled={orderId}`.
  - `expires_at`: 30 minutes from creation (Stripe's minimum allowed
    value).
  - Returns `{ orderId, total, checkoutUrl: session.url }`. No Stripe.js
    publishable key or client library needed — the browser redirects to
    `session.url` directly.
  - If Stripe's API rejects the session (most likely: total below
    Stripe's minimum chargeable amount for VND, roughly 10,000₫), the
    function returns a 400 with a clear message; the client surfaces it
    inline ("Card payment isn't available for this order total — try
    Cash") instead of a generic failure.

### 2. `stripe-webhook` Edge Function (new — was a stub)

- Verifies the Stripe signature (`Stripe-Signature` header) against
  `STRIPE_WEBHOOK_SECRET`. This is the only trust boundary — the
  endpoint is otherwise public and unauthenticated (`verify_jwt`
  disabled, same reasoning as `place-order`: Stripe's own request has no
  Supabase session to attach).
- `checkout.session.completed`: reads `metadata.order_id`, runs
  `update orders set status='paid', payment_status='paid' where id = $1
  and payment_status = 'pending'` using the service-role client. The
  `and payment_status = 'pending'` guard plus `handle_order_paid`'s own
  `old is distinct from 'paid'` check make this safe against Stripe's
  automatic webhook retries — a duplicate delivery is a no-op, not a
  double deduction or double loyalty award.
- `checkout.session.expired`: same lookup,
  `update orders set status='cancelled' where id = $1 and payment_status
  = 'pending'` — only cancels if it never actually got paid (no race
  against a completed payment that's still propagating).
- Returns 200 quickly for any event type it doesn't otherwise handle
  (Stripe will retry on non-2xx).

### 3. New RPC: `cancel_pending_order(p_order_id uuid)`

`security definer`, mirrors `get_order_for_tracking`'s existing
guest-safe pattern (a single-row operation keyed by an unguessable UUID,
never a broad policy):

- Only affects a row where `status = 'pending_payment'` — a no-op
  against an already-paid or already-cancelled order.
- If the order has a `customer_id`, requires `auth.uid() = customer_id`.
- If it's a guest order (`customer_id is null`), allows the caller to
  cancel it by UUID alone — the same trust model `get_order_for_tracking`
  already established (worst case: someone guesses another guest's
  pending-order UUID and cancels it early; no data is exposed, unlike a
  broad `customer_id is null` policy would risk).
- Called by Checkout's self-cancel flow (below). Also available for a
  possible future staff-side "cancel this order" action — not building
  that UI now.

### 4. `components/customer/checkout-view.tsx`

- `PAYMENT_OPTIONS`'s `stripe` entry flips from `enabled: false` to
  `enabled: true` — Card button becomes clickable, tooltip removed.
- "Place Order" submit, when `paymentMethod === "stripe"`: calls the same
  `place-order` invocation as the Cash path, with `paymentMethod:
  "stripe"`, `paymentCollected: false`, and the current locale. If the
  response includes `checkoutUrl`, redirects
  (`window.location.href = checkoutUrl`) instead of the existing
  `router.push` to Order Tracking. `clearCart()` is **not** called on
  this path yet — only once payment is actually confirmed (Order
  Tracking's arrival via `success_url` is the confirmation point) —
  unlike Cash, which still clears immediately since payment there is
  already guaranteed in-hand.
- New: on mount, checks for a `?stripeCanceled={orderId}` query param
  (the `cancel_url` Stripe redirects back to). If present: calls
  `cancel_pending_order` via `supabase.rpc(...)`, shows a small inline
  "Payment cancelled — your cart is still here, try another method"
  notice, and strips the param from the URL. No other UI change needed
  since the cart was never cleared.

### 5. `components/staff/pos-terminal.tsx`

- POS's `card` payment option flips to `enabled: true`.
- "Charge" with `paymentMethod: "card"` sends `paymentMethod: "stripe"`,
  `paymentCollected: true` to `place-order` — identical request shape to
  the existing Cash charge path, just a different enum value. Per
  Section 1, this skips Stripe entirely and marks the order paid
  immediately, since the money was already collected via a physical card
  terminal outside this app.

### 6. Translations

New user-facing strings (the "payment cancelled" notice, the "card
payment unavailable for this total" error) added to both
`messages/vi.json` and `messages/en.json`, per the existing bilingual
convention — no page ships an English-only or Vietnamese-only string.

## Config (manual steps, not automatable via MCP)

- `STRIPE_WEBHOOK_SECRET` must be filled in after the `stripe-webhook`
  function is deployed: create a webhook endpoint in the Stripe
  Dashboard pointed at the deployed function's URL, select
  `checkout.session.completed` and `checkout.session.expired`, copy the
  signing secret into Vercel's env vars. Same category of Dashboard-only
  step as Supabase Auth's URL Configuration (documented in CLAUDE.md's
  Deployment section) — no MCP tool exposes Stripe webhook endpoint
  creation.

## Testing plan

- Stripe test card `4242 4242 4242 4242` for the full success path; a
  documented always-declined test card for the failure path.
- End-to-end: order lands `pending_payment` before redirect → Stripe
  test payment → webhook fires → order flips to `paid` → inventory
  deducts + loyalty points award (existing trigger, unchanged) → Order
  Tracking reflects it live (Realtime for a logged-in customer, polling
  for a guest — both pre-existing).
- Self-cancel: start checkout, use Stripe's own back link, confirm the
  order is `cancelled` and Checkout is usable again with the cart
  intact.
- `checkout.session.expired`: verified via Stripe's dashboard "resend
  test event" rather than waiting a real 30 minutes.
- POS Card charge marks an order paid immediately with zero Stripe API
  calls.
- Per project convention (see CLAUDE.md Deployment section): verify
  against the deployed Vercel URL, not just `npm run dev`.
