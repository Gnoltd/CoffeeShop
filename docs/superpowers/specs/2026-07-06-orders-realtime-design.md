# Real Orders + Realtime (Core, Cash-Only) — Design Spec

**Date:** 2026-07-06
**Status:** Approved, ready for implementation planning.

## Context

Third sub-project of the "make all data real-time" initiative
(decomposition: Inventory → Tables → **Orders** → Staff accounts). Real
Stripe and VNPay integration were explicitly scoped *out* of this spec
during brainstorming — the user wants all three payment methods real and
usable, but building two external payment-gateway integrations (webhook
verification, redirect flows, IPN endpoints) alongside the data/Realtime
work was too much for one spec. Agreed sequencing: **this spec (Orders
core, Cash fully real) → a Stripe spec → a VNPay spec**, each its own
brainstorm → spec → plan → implementation cycle.

### What already exists (migrations `0005`-`0007`, applied)

- `public.tables`/`public.orders`/`public.order_items`/
  `public.order_item_modifiers` (migration `0005_orders.sql`) — full
  schema, RLS enabled. `order_status` enum: `pending_payment | paid |
  preparing | ready | completed | cancelled`. `payment_status` enum:
  `pending | paid | failed | refunded` (a separate, narrower financial
  field). `order_type` enum: `pickup | dine_in` (note the underscore —
  both mock hooks use the hyphenated `"dine-in"`, so the query layer must
  translate).
- `public.payment_transactions`/`public.loyalty_transactions`
  (migration `0006_payments_and_loyalty.sql`) — ready for Stripe/VNPay's
  future specs; `loyalty_transactions` is used by this spec too (real
  point redemption).
- `public.loyalty_settings` (migration `0002_shop_config.sql`) — real
  agreed rates already live: `earn_rate_vnd_per_point = 10000`,
  `redeem_value_vnd_per_point = 100`. The current mock Checkout UI's
  hardcoded "50 points for 10,000đ" (200 VND/point) doesn't match these
  real rates and needs to become dynamic.
- `handle_order_paid` trigger (migration `0007_handle_order_paid.sql`) —
  **already correct, has been dead code since it was written**, waiting
  for real orders to exist. Deducts inventory (via
  `menu_item_ingredients`/`modifier_ingredients`, the Inventory
  sub-project's recipe data) and earns loyalty points, but — important
  discovery — **it's a `before update` trigger only**, keyed on
  `new.payment_status = 'paid' and old.payment_status is distinct from
  'paid'`. It cannot fire on `insert` (there's no `old` row). Any design
  that inserts a row with `payment_status = 'paid'` directly will
  silently skip inventory deduction and loyalty earning. `place_order`
  (below) is designed around this: **always insert at `pending`, then a
  second, real `update` to `'paid'` when payment is already collected** —
  same transaction, but a genuine `old → new` transition the trigger can
  see.
- RLS already correctly covers: Order History (`orders_select_own`,
  `customer_id = auth.uid()` — fine, since `/orders` is already
  auth-gated to logged-in customers per the Profile auth-gate feature) and
  staff KDS/POS reads/writes (`orders_select_staff`/`orders_update_staff`,
  `staff|manager|admin`).

### What's missing / what I found while designing this (not just "wire up the mock")

1. **Two mock systems with incompatible status vocabularies** that have
   never talked to each other: customer tracking (`preparing|ready|
   completed|cancelled`, 4 states) and KDS (`new|preparing|ready`, 3
   states — it just *deletes* an order past "ready," never marking it
   `completed`). Neither matches the real 6-state enum.
2. **A guest can't be authorized to read their own order via a plain RLS
   policy without a real privacy leak.** `orders_select_own` requires
   `customer_id = auth.uid()`, which a guest's `null` customer_id never
   satisfies (`null = null` is `null`, not `true`, in SQL). The
   straightforward-looking fix — add a `customer_id is null` branch to
   the SELECT policy — was rejected during design: RLS policies gate
   *every* row matching the predicate, not just "the one row you asked
   for." A broad `customer_id is null` policy would let any guest with
   the anon key bulk-`select * from orders where customer_id is null` and
   read every other guest's order ever placed (items, table, totals) —
   not the "unguessable-link" security model it was meant to be. Fixed
   instead with a **narrowly-scoped RPC** (`get_order_for_tracking`,
   below) that takes the order id as a required parameter and can only
   ever return that one row — there is no way to "list all" through a
   single-row lookup function.
3. **A related, but moot, insert-side RLS bug.** `orders_insert`'s check
   (`customer_id = auth.uid() or current_user_role() in (...)`) also
   evaluates to `null` (rejected) for a guest inserting `customer_id =
   null`, for the identical three-valued-logic reason. Not fixed in this
   spec: every write in this design goes through the `security definer`
   `place_order` RPC, which — like every `security definer` function in
   this project — bypasses RLS for its own writes. No code path ever
   attempts a raw client insert into `orders`, so this latent bug can
   only make an already-impossible path fail closed, never succeed
   insecurely. Documented, not fixed, to avoid migration scope with no
   behavioral payoff.
4. **Realtime has the same RLS-visibility requirement as a direct
   SELECT — for guests, this means no live push.** Supabase Realtime's
   `postgres_changes` authorization is enforced via the same RLS the
   table already has, independent of how the client did its *initial*
   fetch. A `security definer` RPC unblocks the one-time read; it does
   **not** unblock an ongoing subscription, because Realtime evaluates
   RLS against the subscribing role for every row change, not against
   "did this session already fetch this row through a trusted function."
   Granting a broad SELECT policy to make Realtime work would reintroduce
   exactly the bulk-enumeration leak from point 2. **Resolution: logged-in
   customers and staff get true Realtime; a guest's Order Tracking page
   polls** (a short interval re-call of `get_order_for_tracking`, clearly
   polling, not fake Realtime) — a real, documented trade-off, not a
   hidden gap.
5. **Cash needs a real "payment collected" moment, and POS vs. self-
   checkout differ.** POS-charged cash is collected in person, right
   then — `place_order` can mark it paid immediately (via the
   insert-then-update-to-paid sequence above, in the same call). Self-
   checkout cash ("pay at pickup") has no such moment at order-placement
   time — the order must sit at `pending_payment` until a staff member
   later confirms cash was received. There's currently no UI anywhere for
   that confirmation. Added: a small "Awaiting Payment" list on the
   **POS** page (not Kitchen Display — collecting payment is POS's job,
   KDS is purely kitchen-prep) with a "Confirm Cash Received" action that
   does the real `pending_payment → paid` transition.
6. **Given all this, Stripe/VNPay stay selectable-looking but can't
   actually complete right now.** Placing an order with Stripe or VNPay
   selected today would create a real order permanently stuck at
   `pending_payment` with no way to progress (no gateway integration
   exists yet) — a genuine dead end for a real customer on the live site.
   Per this project's established "disabled + tooltip when there's no
   real backing" convention (used everywhere else for exactly this
   situation), **Stripe and VNPay revert to disabled+tooltip in Checkout
   until their own specs ship** — not a scope reduction from what was
   agreed, just the honest consequence of the sequencing decision already
   made ("Cash first, Stripe next, VNPay after").

## Scope

One implementation plan. Every piece (RPCs → query layer → hook
rewrites → consumer updates → POS payment-confirmation UI → live
verification) depends on the schema/RPCs existing first.

**In scope:** `place_order` and `get_order_for_tracking` RPCs; real
`lib/supabase/orders-data.ts`; rewriting `hooks/useOrders.tsx` and
`hooks/useKitchenOrders.tsx` to read real data (kept as two separate
hooks/providers, same source table, each scoped to what its consumers
need — mirrors how `useInventory`/`useTables` each independently wrap
their own table rather than one mega-hook); unifying the status
vocabulary end-to-end; real Checkout order placement (Cash); real KDS
status advancement (including the previously-missing `completed`
transition); the POS "Awaiting Payment" confirmation UI; Stripe/VNPay
reverting to disabled+tooltip.

**Out of scope:** any Stripe or VNPay gateway code (their own specs);
`payment_transactions` rows (populated once a real gateway exists to
generate them — cash doesn't need a transaction record, the order's own
`payment_method`/`payment_status` is sufficient); promo codes beyond the
existing single hardcoded `WELCOME10` (still no `promotions` table).

## Architecture

### 1. Migration — two RPCs, no schema changes, no RLS policy changes

**`place_order(p_payload jsonb) returns jsonb`** — `security definer`,
`set search_path = public`. Takes a JSON payload shaped like:
```json
{
  "orderType": "pickup" | "dine_in",
  "tableId": "uuid or null",
  "pickupTime": "text (kept as free text, matches today's UI)",
  "paymentMethod": "cash",
  "promoCode": "text or null",
  "redeemLoyaltyPoints": "integer or 0",
  "paymentCollected": "boolean (true only from POS)",
  "items": [
    { "menuItemId": "uuid", "sizeId": "uuid or null", "modifierIds": ["uuid", ...], "quantity": 1, "note": "text or null" }
  ]
}
```
Logic:
1. `customer_id := auth.uid()` (null for a guest — this already works
   correctly with no special-casing, since `auth.uid()` is genuinely null
   for an unauthenticated Edge Function caller).
2. For each item: look up `menu_items.base_price` (rejecting if
   `is_available = false` or the id doesn't exist), add the matching
   `menu_item_sizes.price_delta` if `sizeId` given, sum
   `modifiers.price_delta` for every id in `modifierIds` — **never** uses
   any price the payload might also contain. Computes `unit_price` and
   `subtotal` per line server-side.
3. If `promoCode = 'WELCOME10'` (case-insensitive), discount `:=
   round(subtotal_total * 0.1)`, else `0` — same one hardcoded rule the
   client has today, just re-validated server-side instead of trusted
   from the client.
4. If `redeemLoyaltyPoints > 0`: reject if `customer_id is null` (a guest
   cannot redeem points they don't have an account to hold); reject if
   `redeemLoyaltyPoints > profiles.loyalty_points_balance` for that
   customer; else `loyalty_discount := redeemLoyaltyPoints *
   loyalty_settings.redeem_value_vnd_per_point`, insert a
   `loyalty_transactions` row (`type = 'redeem'`, negative
   `points_change`), and decrement `profiles.loyalty_points_balance` —
   all inside this same function's implicit transaction.
5. Insert the `orders` row with `status = 'pending_payment'`,
   `payment_status = 'pending'` (always, regardless of
   `paymentCollected` — see the trigger note above), `subtotal`,
   `discount_amount := promo_discount + loyalty_discount`, `total`.
6. Insert one `order_items` row per line (server-computed `unit_price`/
   `subtotal`), then one `order_item_modifiers` row per selected modifier
   (server-computed `price_delta`).
7. If `paymentCollected = true` (POS only): `update orders set status =
   'paid', payment_status = 'paid' where id = <new order id>` — a real
   second statement, genuinely triggering `handle_order_paid` (inventory
   deduction + loyalty earning) since it's a true `old.payment_status =
   'pending' → new.payment_status = 'paid'` transition, not folded into
   the original insert.
8. Return `{ "orderId": "...", "total": ... }` as `jsonb`.

`grant execute on function public.place_order(jsonb) to anon,
authenticated;` (guests must be able to call it too).

**`get_order_for_tracking(p_order_id uuid) returns jsonb`** — `security
definer`, `set search_path = public`. Internal authorization check
(replacing what a broad RLS policy would unsafely do):
```sql
where o.id = p_order_id
  and (
    o.customer_id = auth.uid()
    or o.customer_id is null
    or public.current_user_role() in ('staff', 'manager', 'admin')
  )
```
Returns a single `jsonb` object shaped to closely match the existing
`OrderRecord` type (id, createdAt, orderType, table number/location if
dine-in, items with names/quantities/unit prices/notes, subtotal,
discount, total, status) built via `json_build_object`/`jsonb_agg` joining
`order_items`/`order_item_modifiers`/`menu_items`/`tables` — or `null` if
no row matches (wrong id, or a real customer's order that isn't theirs
and isn't a guest order — same "not found" response either way, so this
function can't be used to probe whether an order id exists that you're
not allowed to see). `grant execute ... to anon, authenticated;`.

### 2. Query layer — new `lib/supabase/orders-data.ts`

DI'd like every other query module. Types mirror the existing
`OrderRecord`/`KdsOrder` shapes closely so consumer components change as
little as possible.

```ts
export type RealOrderStatus = "pending_payment" | "paid" | "preparing" | "ready" | "completed" | "cancelled"

export type OrderForTracking = {
  id: string
  createdAt: number
  orderType: "pickup" | "dine-in"
  table?: string
  items: { nameVi: string; nameEn: string; quantity: number; unitPrice: number; note?: string }[]
  subtotal: number
  discount: number
  total: number
  status: RealOrderStatus
}

export type PlaceOrderInput = { /* mirrors the RPC payload shape above, camelCase */ }

export async function placeOrder(supabase, input: PlaceOrderInput): Promise<{ orderId: string; total: number }>
export async function getOrderForTracking(supabase, orderId: string): Promise<OrderForTracking | null>
export async function getMyOrders(supabase): Promise<OrderForTracking[]>          // Order History, logged-in only
export async function getKitchenOrders(supabase): Promise<KdsOrderRow[]>          // staff: status in (paid, preparing, ready)
export async function getPendingPaymentOrders(supabase): Promise<KdsOrderRow[]>   // staff: status = pending_payment, payment_method = cash
export async function advanceOrderStatus(supabase, orderId: string, newStatus: RealOrderStatus): Promise<void>
export async function confirmCashPayment(supabase, orderId: string): Promise<void> // sets status+payment_status to 'paid'
```

`advanceOrderStatus`/`confirmCashPayment`/`getKitchenOrders`/
`getPendingPaymentOrders` are plain table reads/writes (no RPC needed) —
already correctly gated by the existing `orders_select_staff`/
`orders_update_staff` policies.

### 3. Status mapping (replaces both mocks' vocabularies)

| Real `status`     | Customer tracking (4-step bar) | Kitchen Display              |
|--------------------|--------------------------------|-------------------------------|
| `pending_payment`  | not shown (order not yet placed successfully from the tracking page's perspective) | Awaiting Payment list (POS, cash only) |
| `paid`             | Step 1 done                    | "New" column                  |
| `preparing`        | Step 2 done                    | "Preparing" column            |
| `ready`            | Step 3 done                    | "Ready" column                |
| `completed`        | Step 4 done                    | removed from board (now via a real status update, not a silent local delete) |
| `cancelled`        | separate "cancelled" state (as today) | not shown |

KDS's `advance()` becomes a real `advanceOrderStatus` call:
`paid → preparing → ready → completed`, matching `NEXT_STATUS`'s existing
shape but writing through instead of only touching local state.

### 4. `hooks/useOrders.tsx` (customer) — rewritten

Fetches the logged-in customer's own order list (`getMyOrders`) for Order
History, subscribes to `postgres_changes` on `orders` filtered to
`customer_id = auth.uid()` (real Realtime — this works because a logged-in
customer's own `customer_id` genuinely matches their `auth.uid()` under
existing RLS, no leak). For a single order's tracking page: calls
`getOrderForTracking(orderId)` once, then if logged in as that order's
owner or staff, subscribes to Realtime on that one `id`; if it's a guest's
own order (no session), **polls** `getOrderForTracking` every 10 seconds
instead — the documented trade-off from Section "What's missing," point 4.
Checkout's `handlePlaceOrder` becomes async, calling the `place-order`
Edge Function (Section 6) instead of building a local `OrderRecord` and
calling `addOrder`.

### 5. `hooks/useKitchenOrders.tsx` (staff) — rewritten

Fetches `getKitchenOrders()` (status in `paid|preparing|ready`) +
`getPendingPaymentOrders()` on mount, subscribes to `postgres_changes` on
`orders` (staff sees everything, matching `orders_select_staff` — no
guest-visibility concerns here at all). `advance(orderId)` calls
`advanceOrderStatus`. New `confirmCashPayment(orderId)` for the POS
"Awaiting Payment" list. POS's own "Charge" button now calls the
`place-order` Edge Function with `paymentCollected: true` instead of
building a local `KdsOrder` — the real unification point.

### 6. `place-order` Edge Function — real, thin wrapper

Currently a comment-only stub. Becomes real: reads the caller's JWT (if
any) to establish identity, forwards the validated payload to the
`place_order` RPC via a Supabase client created with the **service role
key** (so the function's own call isn't itself subject to RLS — the RPC's
internal `security definer` logic is the actual authorization boundary,
matching how `place_order` already determines `customer_id` from
`auth.uid()` internally rather than trusting anything the Edge Function
passes). For this spec, that's the entire function body — no external API
calls. Shaped this way deliberately so the Stripe/VNPay specs can wrap
gateway calls *around* this same `place_order` invocation later without
re-architecting anything here.

### 7. UI changes

- **Checkout** (`checkout-view.tsx`): `PAYMENT_OPTIONS` — Stripe and
  VNPay buttons become `disabled` with a tooltip (matching every other
  "no real backing yet" affordance in this app); only Cash is selectable.
  Loyalty section reads real `loyalty_settings`/the logged-in customer's
  real `profiles.loyalty_points_balance` instead of
  `MOCK_POINTS_BALANCE`/`MOCK_REDEEM_POINTS`/`MOCK_REDEEM_AMOUNT` — a
  guest sees the loyalty section disabled+tooltip (matches "guests can't
  redeem" from the RPC's own rule). `handlePlaceOrder` calls the Edge
  Function, then routes to `/orders/{realOrderId}` on success, or shows
  a real inline error on failure (e.g. an item went unavailable between
  adding to cart and checkout).
- **Order Tracking** (`order-tracking.tsx`): reads via the new hook
  behavior (Section 4) instead of a local array `.find` with a mock
  fallback — an unknown/inaccessible id now genuinely 404s or shows a
  real "not found," not a fixed fake order (the old
  `FALLBACK_ORDER`/mock-id-not-in-store fallback is removed — it existed
  only because there was no real backend to actually look anything up
  against).
- **Order History** (`order-history.tsx`): reads `getMyOrders()` — only
  reachable already for logged-in customers (existing auth gate), so this
  is a straightforward swap, no new gating logic needed.
- **Kitchen Display**: gains the "Awaiting Payment" list (small, visually
  distinct from the 3-column board — this is staff's payment-collection
  queue, not a kitchen-prep column) with "Confirm Cash Received"; the
  "Ready → done" action now performs a real status update to
  `completed` instead of vanishing the order from local state only.
- **POS**: "Charge" calls `place-order` with `paymentCollected: true`;
  gains its own small "Awaiting Payment" section (self-checkout cash
  orders waiting for a staff member to collect cash and confirm) with the
  same "Confirm Cash Received" action as Kitchen Display — placed on POS
  specifically, per point 5's reasoning above.

## Data Flow

1. **Self-checkout, Cash:** customer builds cart → Checkout → `place-order`
   Edge Function → `place_order` RPC computes real prices/discount,
   inserts `orders`+`order_items`+`order_item_modifiers` at
   `pending_payment`/`pending` → customer lands on Order Tracking (shows
   "awaiting payment," not yet on the 4-step bar) → staff sees it in
   POS's "Awaiting Payment" list, collects cash in person, taps "Confirm
   Cash Received" → real `update` to `paid`/`paid` → `handle_order_paid`
   trigger fires (inventory deducted, loyalty earned) → order appears
   live in Kitchen Display's "New" column (staff session, real Realtime)
   → customer's tracking page picks up the status change (via polling if
   guest, Realtime if logged in) → staff advances `preparing → ready →
   completed` on Kitchen Display, each transition a real
   `advanceOrderStatus` call, live to every session watching.
2. **POS, walk-in, Cash:** staff builds the ticket → "Charge" → same
   `place-order` Edge Function, `paymentCollected: true` → RPC inserts
   then immediately updates to `paid`/`paid` in the same call → trigger
   fires → order appears directly in Kitchen Display's "New" column, no
   "Awaiting Payment" step (payment was already collected at the
   counter).

## Error Handling

- `place_order` rejecting (unavailable item, insufficient loyalty
  balance, promo code no longer valid) surfaces as a real inline error in
  Checkout/POS, not a silent failure — same convention as every other
  mutation in this app.
- `get_order_for_tracking` returning `null` (wrong id, or genuinely not
  yours) renders Order Tracking's existing "not found" affordance — no
  distinction is made between "doesn't exist" and "exists but isn't
  yours," so the function can't be used to probe for valid order ids.
- Realtime subscribe failure (same as Inventory/Tables) degrades to
  "fetched once, not live," with a console warning.
- Guest polling failure (a single failed `get_order_for_tracking` call)
  just tries again on the next interval tick — a transient network blip
  shouldn't show an error screen over a page that already has data to
  show from its last successful fetch.

## Testing

- `lib/supabase/orders-data.test.ts` (new, same fake-Supabase-client
  style as every other query module): mapping correctness for
  `getOrderForTracking`/`getKitchenOrders`, that `placeOrder` calls
  `.rpc("place_order", {...})` with the right payload shape, that
  `advanceOrderStatus`/`confirmCashPayment` issue the right `.update(...)`
  calls.
- Live verification via Playwright, same convention as every prior
  sub-project: place a real self-checkout Cash order as a guest, confirm
  it's initially "awaiting payment" on tracking; as staff, confirm it in
  POS's Awaiting Payment list, confirm inventory/loyalty actually moved
  (`execute_sql`); advance it through Kitchen Display and confirm the
  guest tracking page (polling) picks up each change; separately, place a
  POS walk-in Cash order and confirm it lands directly in KDS "New" with
  no Awaiting Payment step; confirm Stripe/VNPay are disabled+tooltip in
  Checkout.

## Self-Review Notes

- Checked for placeholders/TBDs — none found.
- Checked internal consistency — the insert-then-update sequencing
  (forced by the trigger being `before update` only) is stated once in
  the Context section and referenced consistently in `place_order`'s
  Step 7 and the Data Flow walkthroughs, not restated differently.
- Checked scope — confirmed Stripe/VNPay gateway code stays fully out of
  this plan; every RPC/table this spec touches already exists.
- Confirmed the originally-presented "public read for guest orders by
  ID" approved during brainstorming is preserved in *intent* (a guest can
  read their own order by ID) while the *mechanism* was corrected during
  design to a narrowly-scoped RPC instead of a broad RLS policy, once the
  bulk-enumeration risk of the broad-policy version was found — documented
  transparently in point 2 rather than silently substituted.
