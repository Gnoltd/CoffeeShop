# Menu Data Migration + Stripe Payments (Slice 1) — Design

**Date:** 2026-07-05
**Status:** Proposed — pending user review before writing an implementation plan.

## Overview

Two dependent pieces of work, scoped together because the second cannot be
built correctly without the first:

1. **Menu Data Migration** — replace `lib/mock-data/menu.ts` with real
   Supabase data. `order_items.menu_item_id` is a `NOT NULL` foreign key
   into `menu_items`; a real order cannot be created while the menu only
   exists as mock data.
2. **Stripe Payments (Slice 1 of 2)** — a real `place-order` Edge Function
   plus Stripe Checkout Session + webhook, so an order placed with Stripe
   as the payment method results in a real paid order, real inventory
   deduction, and real loyalty points earned (reusing the `handle_order_paid()`
   trigger that already exists from the original schema migrations).

VNPay integration is **Slice 2**, a separate future spec, reusing
`place-order` and the `verify-payment` function built here. Not designed
in this document beyond the parts of this design (like `verify-payment`)
that are deliberately built to be reused by it.

## Scope boundaries (explicitly out of this spec)

- VNPay integration itself (Slice 2).
- Real image upload to Supabase Storage for menu items — stays as local
  `URL.createObjectURL` previews, unchanged from today.
- Cash-order staff/POS confirmation flow changes — `place-order` supports
  `paymentMethod: 'cash'` structurally (creates the real order), but no
  new staff-side "mark cash order paid" UI is built here; that's separate,
  already-existing POS/KDS territory.
- Realtime subscriptions for order status (Order Tracking currently
  re-fetches; upgrading to a live Supabase Realtime subscription is a
  natural follow-up, not required for this spec to work correctly).

---

## Part 1: Menu Data Migration

### Schema — migration `0008_menu_translations.sql`

The applied schema (migration `0003_menu`) has single `name`/`description`
columns. Since every menu table is still empty, this migration cleanly
replaces rather than adds alongside:

- `categories.name` → `name_vi text not null`, `name_en text not null`
- `menu_items.name`/`description` → `name_vi`, `name_en`, `description_vi`,
  `description_en` (all `text`, name columns `not null`)
- `modifier_groups.name` → `name_vi`, `name_en`
- `modifiers.name` → `name_vi`, `name_en`
- `menu_item_sizes.name` **stays a single column** — checked the actual
  mock data; sizes are "S"/"M"/"L", genuinely language-neutral. Splitting
  it would be pure churn.

This decision keeps the app's established bilingual-everywhere convention
(every other piece of app text already has vi/en pairs; Menu Management
and the Menu grid already render both languages side by side) instead of
quietly regressing to Vietnamese-only menu content.

### Seed data — migration `0009_seed_menu_data.sql`

Inserts today's mock menu content (4 categories, 8 items, the S/M/L size
set, the milk modifier group with 2 options) as real rows with real
`gen_random_uuid()` ids. `lib/mock-data/menu.ts`'s readable slug ids
(`phin-sua-da`, etc.) do not carry over — nothing outside that file
depends on the slug values themselves, only on the shape of the data.
After this migration, `lib/mock-data/menu.ts` is retired as a live data
source (deleted or reduced to a comment pointing at the real tables —
decide at implementation time based on whether anything still finds it
useful as fixture data for tests).

### Frontend changes

Every current consumer of `lib/mock-data/menu.ts` switches to real
Supabase queries:

| Component | Change |
|---|---|
| `components/customer/menu-browser.tsx` | `categories`/`menu_items` (+ sizes/modifiers on demand) via `select`, filtered to `is_available = true` for customers |
| `components/customer/product-detail.tsx` | Fetch by real `id` (uuid), `notFound()` on a missing row (same behavior as today, just a real query instead of an array `.find()`) |
| `components/staff/pos-terminal.tsx` | Same query as Menu Browser, reused |
| `components/admin/menu-management.tsx` + `menu-item-form.tsx` | Real `insert`/`update`/`delete` against `categories`/`menu_items`/`menu_item_sizes`/`modifier_groups`/`modifiers` (RLS already restricts writes to manager/admin — now enforceable since real auth exists) |

`lib/mock-data/reviews.ts` is unaffected — ratings/reviews stay
deliberately mock (documented gap, no `reviews` table exists or is planned
in this spec).

---

## Part 2: Stripe Payments (Slice 1)

### New Edge Functions

| Function | Trigger | Responsibility |
|---|---|---|
| `place-order` | Called by Checkout via `supabase.functions.invoke` | Re-validates cart against real DB prices and the customer's real loyalty balance (never trusts client-submitted numbers); inserts `orders`/`order_items`/`order_item_modifiers` using the service role (see "Guest order access" below for why); for `paymentMethod: 'stripe'`, creates a Stripe Checkout Session + a `payment_transactions` row and returns a redirect URL |
| `stripe-webhook` | Stripe → our server, on `checkout.session.completed` | Verifies the Stripe signature (`STRIPE_WEBHOOK_SECRET`), marks the matching `payment_transactions` row `succeeded`, sets `orders.payment_status = 'paid'` — which fires the **already-existing** `handle_order_paid()` trigger (inventory deduction + loyalty earn); idempotent by construction, since that trigger only fires `when new.payment_status='paid' and old is distinct from 'paid'` |
| `verify-payment` | Called by Order Tracking the moment the customer returns from Stripe | Calls Stripe's API directly to check the Checkout Session status and flips `payment_status` itself if the webhook hasn't landed yet — this is what makes confirmation fast instead of waiting on webhook latency. Takes a `provider` field so Slice 2 (VNPay) can reuse it for its return-URL flow. Safe to race with the webhook — same idempotency guard applies |
| `save-payment-credentials` | Called by the new Settings UI | Encrypts and stores a submitted secret via `vault.create_secret()`/`vault.update_secret()`; never returns the plaintext value back |

### Schema — migration `0010_payment_provider_secrets.sql`

```sql
create table public.payment_provider_secrets (
  key text primary key, -- 'stripe_secret_key' | 'stripe_webhook_secret' | 'vnpay_tmn_code' | 'vnpay_hash_secret'
  secret_id uuid not null, -- id returned by vault.create_secret()
  updated_at timestamptz not null default now()
);
alter table public.payment_provider_secrets enable row level security;
-- no select/insert/update policy for anon/authenticated: only accessed by
-- Edge Functions running with the service role.
```

A small `public.payment_providers_configured()` `security definer` SQL
function returns `{"stripe": true, "vnpay": false}` (existence booleans
only, never the secret values) — callable by anyone, used by Checkout to
decide which payment buttons to show.

### Checkout UI changes

- Payment method buttons are filtered by `payment_providers_configured()`
  — Cash always shown; Stripe/VNPay only shown once configured.
- "Place Order" now calls `place-order` instead of building a local
  `OrderRecord` and calling the mock `addOrder()`.
- If the response includes a `redirectUrl` (Stripe path), the browser
  navigates there directly (`window.location.href`, a real cross-origin
  navigation — not a Next.js router push).
- Cash path: `place-order` still creates the real order; no redirect,
  goes straight to `/orders/{orderId}`.
- Loyalty point redemption is only offered when there's a real logged-in
  `customer_id` — `place-order` validates the redemption against that
  customer's actual `profiles.loyalty_points_balance`; a guest checkout
  has no profile to redeem against, so the redeem toggle is hidden for
  guests (it already requires `activeTable`-style customer context to
  mean anything).
- `hooks/useOrders.tsx`'s local Context+localStorage store is retired as
  the source of truth for Order Tracking and Order History once this
  ships — both switch to real queries (`get_order_for_tracking` for the
  guest case, real RLS-scoped `select` for logged-in customers). The
  `place-order` response already contains everything needed to render
  Order Tracking immediately after redirect, so the first paint doesn't
  even need to wait on a fresh query.

### Order Tracking UI changes — new payment-status states

Three new Stitch-designed states, ported the same way every other screen
in this app was (`design/stitch-exports/05-order-tracking-payment-*.html`,
generated in Stitch project `4654820544595168289` from the existing Order
Tracking screen `abeb78bec53d4a7cb61ceafcb81d45c7`):

1. **Confirming Payment** — shown immediately when the customer lands
   back from Stripe with `?stripe_session_id=...` and the order is still
   `pending_payment`. Real implementation adds a genuine pulsing/spinning
   loader (not the static icon in the mockup) while `verify-payment` is
   in flight.
2. **Payment Confirmed** — green circle, checkmark, amount + provider
   shown (e.g. "60,000đ paid via Stripe"), tracker proceeds into the
   existing Preparing/Ready/Completed steps unchanged.
3. **Payment Failed** — distinct error-red circle with an X (not the
   brand red, to avoid confusion), remaining tracker steps grayed out
   inactive, "Try Again" (→ Checkout) and "Back to Menu" actions.

All three are one new reusable component, `PaymentStatusStep`, taking a
`status: 'confirming' | 'paid' | 'failed'` prop and owning its own
icon/color/transition animation (smooth color + scale pop-in when
resolving from the pulsing "confirming" state into green or red) —
isolated from the rest of Order Tracking's rendering, easy to test alone.

### Guest order-tracking access (explicit tradeoff)

Guest (not-logged-in) checkout is an existing, intentional feature — but
`orders`' RLS policy (`orders_select_own using (customer_id = auth.uid())`)
can never match for a guest, since both sides are `null` and `null = null`
is not `true` in SQL. A guest could place an order but never look it up
again through ordinary RLS.

**Decision:** treat the order's own `id` (a `gen_random_uuid()`, 122 bits
of randomness) as an unguessable capability token for guest tracking,
via a narrow `security definer` function `get_order_for_tracking(order_id
uuid)` returning the order + items to anyone who supplies the exact id —
the same trust model real-world delivery-tracking links use ("possession
of the link is authorization"). This is **not** cryptographically
equivalent to RLS-scoped access; it's flagged here explicitly because
it's a deliberate, scoped exception to this app's usual RLS-everywhere
model, not an oversight. Logged-in customers still get real RLS-scoped
access via `orders_select_own` as already built.

### Settings — payment provider credentials

New "Payment Providers" card in `components/admin/settings-view.tsx`,
one section per provider (Stripe: secret key + webhook secret; VNPay:
TMN code + hash secret — inputs only, ready for Slice 2). Each field:

- Empty + a text input, if never configured.
- Masked placeholder (`sk_live_••••••••1234`) + a "Replace" affordance,
  if already configured — never re-displays the real value.
- Saving calls `save-payment-credentials`, which writes to Vault, never
  to a plain column.

---

## Testing approach

- `place-order`, `stripe-webhook`, `verify-payment`: Vitest unit tests
  against the pure `handleRequest(req: Request): Promise<Response>`
  handler functions (matching the existing plan doc's Edge Function
  pattern), mocking the Supabase service-role client and the Stripe SDK.
- Migration 0008/0009/0010: applied and verified live against the hosted
  project via the Supabase MCP tools (`apply_migration`, `list_tables`,
  `get_advisors`), same process used for the original 7 migrations.
- Frontend: manual verification via a real browser (Playwright, ad hoc —
  see `CLAUDE.md`'s Database section for why no `chromium-cli` is
  available here) driving the actual Checkout → Stripe test-mode card →
  webhook → Order Tracking flow end-to-end with Stripe's documented test
  card numbers.
