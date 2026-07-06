# VNPay Payment Integration — Design Spec

**Date:** 2026-07-07
**Status:** Approved, ready for implementation planning.

## Context

Last remaining item from the Cash → Stripe → VNPay payment sequencing
agreed in the Orders Realtime spec
(`docs/superpowers/specs/2026-07-06-orders-realtime-design.md`). Cash and
Stripe are both real and shipped (see CLAUDE.md's "Real orders +
Realtime" and "Stripe payment integration" sections). Checkout's VNPay
button and POS's VNPay button are both `disabled` + tooltip today.

### What already exists

- `place_order` RPC and the extended `place-order` Edge Function (see
  the Stripe spec) are already payment-method-agnostic — `place_order`
  itself doesn't care which `payment_method` enum value it's given, and
  `place-order` already branches on `paymentMethod`/`paymentCollected`
  to decide whether to build a redirect URL. This spec adds a VNPay
  branch alongside the existing Stripe one, not a parallel system.
- `payment_method` enum already includes `'vnpay'` as a real, distinct
  value (unlike Stripe/Card, which reuses `'stripe'` for both online and
  in-person POS charges) — migration `0005_orders.sql`.
- `cancel_pending_order` RPC (migration `0018`, from the Stripe work) is
  reused as-is — no VNPay-specific cancellation logic needed.
- `supabase/functions/vnpay-ipn/index.ts` and
  `supabase/functions/vnpay-return/index.ts` are currently one-line
  comment stubs.
- Env vars already present in `.env.local` and synced to Vercel:
  `VNPAY_TMN_CODE` (real, registered sandbox merchant — confirmed with
  the user, not a placeholder), `VNPAY_HASH_SECRET` (real sandbox
  value), `VNPAY_RETURN_URL` (already split by environment — the real
  domain for Production/Preview, `localhost:3000` for Development, per
  CLAUDE.md's Deployment section). None of these are read by any code
  yet.
- **Gotcha already learned from the Stripe work, applies again here**:
  Supabase Edge Function secrets (`Deno.env`) are a separate store from
  Vercel's env vars. `VNPAY_TMN_CODE`/`VNPAY_HASH_SECRET` being synced to
  Vercel does **not** make them available inside `place-order`/
  `vnpay-ipn`/`vnpay-return` — they must also be set as Supabase Edge
  Function secrets (see "Config" below).

### How VNPay's model differs from Stripe's (why this isn't a copy-paste)

1. **No "create session" API call.** Stripe required an API round-trip
   to create a Checkout Session before redirecting. VNPay's payment URL
   is built entirely locally — a signed query string appended to a fixed
   gateway URL — no network call needed to produce it.
2. **One return URL, not two.** Stripe gave Checkout a distinct
   `success_url` and `cancel_url`. VNPay redirects the browser back to a
   single `vnp_ReturnUrl` for every outcome, distinguished by a
   `vnp_ResponseCode` param (`"00"` = success; anything else = failed or
   customer-cancelled).
3. **IPN (server-to-server) is the sole source of truth for "paid."**
   Not because the signed return redirect is less secure — it isn't,
   the same hash covers it — but because it isn't guaranteed to fire (a
   closed tab skips it entirely). VNPay's IPN call always fires from
   VNPay's own servers. This mirrors Stripe's webhook-is-source-of-truth
   design exactly.
4. **Amount convention is the opposite of Stripe's.** VNPay always wants
   `vnp_Amount = total × 100` regardless of currency (not a zero-decimal
   currency exception like Stripe's VND handling) — an easy point of
   confusion given the Stripe code sitting right next to it does the
   opposite. Called out explicitly in code comments to prevent exactly
   that mistake.
5. **VNPay's IPN response is a specific `{RspCode, Message}` JSON
   contract**, not a bare 200 — an incorrect/missing code causes VNPay
   to retry indefinitely.

## Scope

**In scope:**
- Customer self-checkout `/checkout` VNPay button → real VNPay redirect,
  IPN-confirmed payment, return-URL-driven success/cancel handling.
- POS "VNPay" button → marks an order paid immediately, no VNPay API
  call (money already collected via an in-person VNPay QR/terminal
  outside this app — same pattern as POS's Card option).

**Explicitly out of scope:**
- Refunds/disputes — handled manually via the VNPay merchant portal.
- Any VNPay payment method beyond the standard redirect gateway (e.g.
  pre-selecting a specific bank code to skip VNPay's method-selection
  page) — the default flow is sufficient.

## Design

### 1. `place-order` Edge Function (extended again)

Adds a VNPay branch alongside the existing Stripe branch, keyed the same
way: `paymentMethod === "vnpay"` and `paymentCollected !== true`.

- Builds the required `vnp_*` parameters: `vnp_Version=2.1.0`,
  `vnp_Command=pay`, `vnp_TmnCode` (from the `VNPAY_TMN_CODE` secret),
  `vnp_Amount = total × 100` (VNPay's own convention — **not** the
  zero-decimal treatment used for Stripe/VND a few lines away in the
  same file; commented explicitly to prevent the two being confused),
  `vnp_CurrCode=VND`, `vnp_TxnRef` = the order's UUID (already globally
  unique — no separate reference generation needed), `vnp_OrderInfo` =
  a fixed description string, `vnp_OrderType=other`, `vnp_Locale` = the
  client-supplied `locale` field directly (VNPay's own locale codes are
  `vn`/`en`... concretely `vn` not `vi`, so this needs a one-value
  translation: `locale === "vi" ? "vn" : "en"`), `vnp_ReturnUrl` = the
  deployed `vnpay-return` function's URL with `?orderId=`/`&locale=`
  appended, `vnp_IpAddr` = the request's IP (from `X-Forwarded-For`,
  falling back to `"127.0.0.1"` if absent), `vnp_CreateDate`/
  `vnp_ExpireDate` in `yyyyMMddHHmmss` format in the `Asia/Ho_Chi_Minh`
  timezone (VNPay requires this specific timezone regardless of where
  the function actually runs), expiry 15 minutes out.
- Signs by sorting all `vnp_*` keys alphabetically, building a
  `key1=value1&key2=value2...` string, computing HMAC-SHA512 with
  `VNPAY_HASH_SECRET` via Web Crypto (no external library — matches the
  Stripe branch's no-SDK approach), and appending the hex digest as
  `vnp_SecureHash`.
- Returns `{ orderId, total, checkoutUrl }` — the exact same response
  shape the client already handles from the Stripe work; no client-side
  branching needed on which gateway was used.

### 2. `vnpay-ipn` Edge Function (new — was a stub)

- Receives VNPay's GET request with `vnp_*` query params (VNPay's IPN
  is a GET, unlike Stripe's POST webhook).
- Recomputes the hash over all params except `vnp_SecureHash` itself
  (per VNPay's spec) and compares.
- Looks up the order by `vnp_TxnRef`. Response contract (VNPay retries
  on any code other than `"00"`/`"02"`/`"01"`/`"04"`/`"97"` — i.e. any
  code not in its documented set is treated as a transient failure):
  - Hash mismatch → `{"RspCode": "97", "Message": "Invalid signature"}`
  - Order not found → `{"RspCode": "01", "Message": "Order not found"}`
  - `vnp_Amount / 100` doesn't equal the order's real `total` →
    `{"RspCode": "04", "Message": "Invalid amount"}` — VNPay's own
    echoed amount is never trusted without checking it against the
    order row we already computed server-side in `place_order`.
  - Order already `payment_status = 'paid'` →
    `{"RspCode": "02", "Message": "Order already confirmed"}` —
    idempotent, handles VNPay's own IPN retries the same way the Stripe
    webhook's guard handles Stripe's retries.
  - `vnp_ResponseCode === "00"` and all checks pass → guarded `UPDATE`
    to `status='paid', payment_status='paid'` (same
    `where payment_status = 'pending'` guard pattern as Stripe's
    webhook, so `handle_order_paid`'s inventory/loyalty logic fires
    exactly once) → `{"RspCode": "00", "Message": "Confirm Success"}`.
  - Any other `vnp_ResponseCode` → guarded `UPDATE` to `cancelled` →
    still `{"RspCode": "00", "Message": "Confirm Success"}` (VNPay is
    told "IPN received," regardless of whether the underlying payment
    itself succeeded — the `RspCode` field is about IPN delivery, not
    payment outcome).
- `verify_jwt` disabled — VNPay's own server calls this with no
  Supabase session at all, same reasoning as the Stripe webhook.

### 3. `vnpay-return` Edge Function (new — was a stub)

- Receives the browser's redirect (same `vnp_*` params plus the
  `orderId`/`locale` this project appended to `vnp_ReturnUrl` itself).
- Verifies the hash the same way as `vnpay-ipn`.
- On success (`vnp_ResponseCode === "00"` and hash valid): HTTP 302
  redirect to `{SITE_URL}/{locale}/orders/{orderId}` (reuses the
  existing Order Tracking route untouched, same as Stripe's
  `success_url`).
- On failure/cancel (valid hash, non-`"00"` code): calls
  `cancel_pending_order(orderId)` (reused as-is, already guest-safe and
  idempotent — a no-op if IPN already resolved the order first, which
  is expected to usually win the race since it's server-to-server and
  faster than a browser redirect completing) then redirects to
  `{SITE_URL}/{locale}/checkout?paymentFailed=1`.
- On hash mismatch (tampered/forged redirect): redirects to checkout
  with a generic error, does **not** touch the order at all.

### 4. `components/customer/checkout-view.tsx`

- VNPay is currently a separately hardcoded disabled `<button>`, not
  part of the `PAYMENT_OPTIONS` array that `stripe`/`cash` already use.
  Folded into `PAYMENT_OPTIONS` as `{ id: "vnpay", icon: QrCode,
  labelKey: "payVNPay", enabled: true }` — removes a duplicated
  button-rendering block, not a broader refactor.
- No new submit-path branching needed: the existing `if
  (data.checkoutUrl) { window.location.href = data.checkoutUrl; return
  }` logic from the Stripe work is already payment-method-agnostic.
- New: a `?paymentFailed=1` query param (set by `vnpay-return`, not
  handled client-side the way Stripe's `?stripeCanceled=` needed a
  client-triggered RPC call — VNPay's cancellation already happened
  server-side before this redirect) triggers the same existing
  cancelled-payment notice UI, reusing the `paymentCanceledNotice`
  translation key rather than adding a near-duplicate string.

### 5. `components/staff/pos-terminal.tsx`

- VNPay's `enabled` check gains `"vnpay"` alongside `"cash"`/`"card"`.
- `paymentMethod === "vnpay"` sends `paymentMethod: "vnpay"`,
  `paymentCollected: true` — `place-order` skips the VNPay branch
  entirely and marks the order paid immediately, identical reasoning to
  POS's Card option (money already collected in person, no VNPay API
  call).

### 6. Translations

`payVNPay` added to both `messages/vi.json`/`messages/en.json`'s
`Checkout` namespace (previously a hardcoded `"VNPay"` string in the
component, not translated at all). No other new strings — `paymentFailed`
reuses the existing `paymentCanceledNotice` copy.

## Config (manual steps, not automatable via MCP)

- `VNPAY_TMN_CODE` and `VNPAY_HASH_SECRET` must be set as **Supabase
  Edge Function secrets** (Dashboard → Edge Functions → Secrets, or
  `supabase secrets set`) — being in `.env.local`/Vercel does not make
  them available to `Deno.env` inside an Edge Function, per the gotcha
  already hit twice during the Stripe work.
- A `SITE_URL` secret already exists from the Stripe work (production
  domain) — reused as-is for building `vnpay-return`'s redirect targets,
  no new secret needed there.
- No Dashboard-side webhook registration step is needed for VNPay
  (unlike Stripe) — `vnp_ReturnUrl`/the IPN URL are both passed as plain
  parameters on each individual payment request, not configured
  globally in a merchant dashboard.

## Testing plan

- VNPay sandbox test card numbers (from VNPay's sandbox documentation)
  for the success path; a documented failure-triggering test card for
  the cancel/fail path.
- End-to-end: order lands `pending_payment` before redirect → VNPay
  sandbox payment → IPN fires → order flips to `paid` → inventory
  deducts + loyalty points award (existing trigger, unchanged) → Order
  Tracking reflects it.
- Return-URL-driven cancel: fail/cancel a sandbox payment, confirm the
  order is `cancelled` and Checkout shows the failure notice with the
  cart intact.
- IPN idempotency: manually re-send an already-processed IPN call (via
  a saved request replay) and confirm the second call returns `RspCode:
  "02"` without double-deducting inventory or double-awarding loyalty
  points.
- POS VNPay charge marks an order paid immediately with zero VNPay API
  calls.
- Per project convention (see CLAUDE.md Deployment section): verify
  against the deployed Vercel URL, not just `npm run dev`.
