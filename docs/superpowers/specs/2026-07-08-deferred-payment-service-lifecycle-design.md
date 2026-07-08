# Deferred Payment + Table-Driven Service Lifecycle — Design

## Problem

Today, payment always happens *before* the kitchen ever sees an order —
across all three payment methods (Stripe, VNPay, Cash) and both order
types (pickup, dine-in). There's no way to order first and pay after
eating (the classic sit-down restaurant model), and there's no explicit
"food has been delivered" step between the kitchen finishing an order
and it being considered done.

## Goals

1. Checkout offers a **Pay Now / Pay Later** choice, for both order
   types, across all three payment methods.
2. **Pay Later** orders skip the pre-kitchen payment gate entirely —
   they reach the kitchen immediately; payment happens later.
3. A new **`served`** order status, set from the table's own card in
   the KDS Tables column for dine-in (not the order card — per the
   table-driven model already established for occupancy/cleaning), or
   from the existing Ready-column tap for pickup (no table to attach a
   "served" action to).
4. An order becomes `completed` **automatically** the instant both
   conditions are true — `status = 'served'` and `payment_status =
   'paid'` — regardless of which one becomes true first. Pay Now orders
   satisfy the payment half before serving, so tapping "Served"
   completes them immediately (no behavior change from today, just a
   renamed intermediate step). Pay Later orders satisfy the serving half
   first and wait on payment.
5. Deferred Stripe/VNPay payment is customer-triggered, from their
   existing order-tracking page, once the order is `served`.
6. Deferred cash payment is staff-triggered — reusing the existing
   "Confirm Cash Received" pattern, just relocated to fire post-serving
   instead of pre-kitchen.
7. Ties directly into the already-shipped table Cleaning lifecycle
   (`docs/superpowers/specs/2026-07-08-table-status-design.md`) — the
   existing `sync_table_occupancy` trigger needs **zero changes**; it
   already fires on any order reaching `completed`.

## Non-goals

- Per-item serving granularity — "Served" is a table-level (or, for
  pickup, order-level) action, not tracked per dish.
- A table with two simultaneously-`ready` orders (a second round ready
  at the same moment as the first) gets one "Served" tap that advances
  *all* of that table's `ready` orders together. This is a deliberate
  simplification, consistent with how the Cleaning trigger already
  treats a table's orders in aggregate rather than individually.
- Any change to Stripe/VNPay webhook/IPN signature verification —
  reused as-is; only *when* a session/redirect is created moves.
- Refunds, partial payments, or split checks.
- Any change to Pay Now semantics or the existing `pending_payment` →
  `paid` flow — untouched.

## Design

### 1. `order_status`: add `served`

```sql
alter type public.order_status add value 'served' after 'ready';
```

No other enum values change. `served` sits between `ready` (kitchen
work is done) and `completed` (fully done — served *and* paid).

### 2. Auto-completion trigger

```sql
create or replace function public.complete_order_when_served_and_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'served' and new.payment_status = 'paid' and old.status is distinct from 'completed' then
    new.status := 'completed';
  end if;
  return new;
end;
$$;

drop trigger if exists on_order_served_and_paid on public.orders;
create trigger on_order_served_and_paid
  before update on public.orders
  for each row
  execute function public.complete_order_when_served_and_paid();
```

Same `before update`, mutate-`NEW`-directly pattern as the existing
`handle_order_paid` (migration `0007`) — no recursive `UPDATE`
statement, so the row is only ever written once per transition. Because
this trigger and `handle_order_paid` both fire unscoped `before update`
on `orders`, Postgres runs them in trigger-name alphabetical order
(`on_order_paid` before `on_order_served_and_paid`) — they act on
independent concerns (inventory/loyalty vs. completion promotion) so
their relative order doesn't matter for correctness.

Once `status` reaches `completed` here, the **existing**
`sync_table_occupancy` trigger (fires `after update of status`, already
live) sees it and runs its unchanged "last active order for this table
done → move to `cleaning`" logic. No modification needed there.

### 3. `place_order`: a `payAt` choice

The `place_order` RPC and the `place-order` Edge Function gain a
`payAt: "now" | "later"` field on the order payload (default `"now"`,
preserving today's behavior exactly for anything that doesn't pass it).

- **`payAt: "now"`** — unchanged in every respect: order inserts at
  `pending_payment`, and the existing per-method logic (Stripe Checkout
  Session, VNPay redirect URL, or cash-collected-in-person for POS)
  proceeds exactly as it does today.
- **`payAt: "later"`** — the order inserts directly at `status =
  'paid'` (the kitchen-visible status — bypassing `pending_payment`
  entirely) with `payment_status` left at `pending`. No Stripe session
  or VNPay redirect is created at placement time, for any of the three
  `payment_method` values — the chosen method is still recorded on the
  order (so staff/customer know how the guest intends to pay later),
  it's just not collected yet.

This means `order.status = 'paid'` no longer strictly implies "payment
received" — it already meant "visible to the kitchen," and Pay Later
makes that distinction from `payment_status` explicit rather than
incidental. The two columns were already independent in the schema;
this is the first case that actually exercises them being out of sync.

### 4. Checkout UI: Pay Now / Pay Later toggle

`components/customer/checkout-view.tsx` gets a new toggle next to
payment method selection, available for both `pickup` and `dine-in`,
all three payment methods. Selecting Pay Later sets `payAt: "later"` on
the `place_order`/`place-order` call; Pay Now (default) is unchanged.

### 5. Serving and deferred-payment collection — two surfaces, by order type

**Dine-in — the table card.** `components/staff/kitchen-tables-column.tsx`
already renders one card per table from `useTables()`. It additionally
reads the shared `useKitchenOrders()` orders list (already
Realtime-subscribed, available in the same staff page tree) and
cross-references by `table_id` (a new field needed on `KdsOrderRow` —
today only `table: string` — the display number — exists; `getKitchenOrders`'s
`ORDER_SELECT` needs `table_id` added, and its status filter widened
from `['paid','preparing','ready']` to include `'served'`, so served-
but-unpaid orders remain in the shared list for the table card to read,
even though they no longer render as a card in any of the three kitchen
board columns — `kitchen-board.tsx`'s `COLUMNS` config stays
`paid`/`preparing`/`ready` only, unchanged):

- Table has a `ready` order → card shows a **"Served"** button. Tapping
  it advances all of that table's `ready` orders to `served` (a small
  client-side loop calling the existing `advanceOrderStatus`, now with
  `'served'` added to `RealOrderStatus`).
- Table has a `served` order with `payment_status = 'pending'` → card
  shows an **"Awaiting Payment"** badge. If that order's
  `payment_method === 'cash'`, the card also shows a **"Confirm Cash
  Received"** button — a new, narrower action that updates only
  `payment_status` (not `status`, unlike today's `confirmCashPayment`,
  which also forces `status: 'paid'` because that's the only way a
  *pre-kitchen* cash order becomes kitchen-visible; a *served* order is
  already kitchen-visible, so only `payment_status` needs to change,
  and the new trigger from Section 2 takes it to `completed`). For
  Stripe/VNPay, no button — just the badge; see Section 6.

**Pickup — the existing Ready-column tap, and the existing pending-cash
banner, both slightly extended.** Pickup has no table to attach a
"Served" action to, so (per the earlier decision) there's no separate
tap: the Ready column's existing action button (`kitchen-board.tsx`,
today labeled "Complete", today sets `NEXT_STATUS.ready = 'completed'`
directly) changes to set `served` instead of `completed` for *both*
order types — the auto-completion trigger immediately promotes it to
`completed` when payment is already settled (Pay Now, or Pay Later
already paid), so a Pay Now pickup order still completes in exactly one
tap, unchanged from today. **For dine-in specifically, this same
Ready-column button is removed** — serving a table happens from the
table card (Section 5's first bullet) instead, so a dine-in order's
Ready-column card shows no action button once the table-card model
takes over that role.

For a Pay-Later pickup order sitting at `served`/`payment_status:
pending` with `payment_method: cash`, there's no table card to surface
"Confirm Cash Received" on — so `components/staff/kitchen-pending-payment.tsx`
(today only queries `pending_payment` + cash, i.e. pre-kitchen Pay Now
cash orders) gets a second query branch: `status = 'served' AND
payment_status = 'pending' AND payment_method = 'cash' AND order_type =
'pickup'`. Its existing "Confirm Cash Received" button reuses the same
narrow served-order confirmation action described above (payment_status
only) for orders from this branch, and the existing dual-field update
for orders from the original pre-kitchen branch — the component already
knows which order it's rendering, so it can pick the right action per
row.

### 6. Customer-triggered late payment (Stripe/VNPay)

The order-tracking page/component (`hooks/useOrders.tsx` and its
consuming tracking view) shows a **"Pay Now"** button once
`status = 'served'` (or later) and `payment_status = 'pending'` and
`payment_method` is `stripe` or `vnpay`. Tapping it calls a new
endpoint (a small addition alongside `place-order`, or a new Edge
Function — exact shape decided in the implementation plan) that builds
the same Stripe Checkout Session / VNPay redirect URL `place-order`
already knows how to construct for that method, just invoked against
an existing order instead of at placement time, then redirects the
customer through the identical payment flow already in production. The
existing `stripe-webhook`/`vnpay-ipn`/`vnpay-return` functions need no
changes — they already flip `payment_status` on the order id they're
given, regardless of when that order was created or when the session
was generated.

### 7. Testing

No Deno/pg test harness in this project (established convention) —
verified live, per payment method, per `payAt` choice:

- Pay Now (all 3 methods, both order types): confirm zero behavior
  change from before this feature — order reaches kitchen only after
  payment, single tap completes it.
- Pay Later + Cash, dine-in: order reaches kitchen immediately: table
  goes `occupied`; advance through Preparing/Ready; tap "Served" on the
  table card; confirm "Awaiting Payment" + "Confirm Cash Received"
  appear; tap it; confirm the order auto-completes and the table
  auto-moves to `cleaning`.
- Pay Later + Stripe/VNPay, dine-in: same, but confirm the "Pay Now"
  button appears on the tracking page once served, and completing that
  checkout flow auto-completes the order via the existing
  webhook/IPN → `payment_status` → trigger chain.
- Pay Later + Cash, pickup: confirm it reaches the kitchen immediately,
  the Ready-column tap sets it to `served`, and the extended
  `kitchen-pending-payment.tsx` banner picks it up for cash
  confirmation.
- Pay Later + Stripe/VNPay, pickup: confirm the tracking-page "Pay Now"
  button appears and completes the order the same way as dine-in.

## Open questions resolved during brainstorming

- **Scope**: applies to all orders, including pickup, not just dine-in.
- **Payment methods eligible for Pay Later**: all three (Cash, Stripe,
  VNPay) — not cash-only.
- **"Kitchen Confirm"**: turned out to need no schema or status change
  at all — it's just today's existing "Start Preparing" tap, already
  the moment an order is accepted by the kitchen.
- **Where "Served"/"Awaiting Payment"/"Paid" live for dine-in**: the
  table's own card in the KDS Tables column, not the order card —
  extending the table-driven model from the table-status feature,
  rather than adding more order-board columns.
- **Pickup "Served"**: no separate tap — folded into the existing
  Ready-column completion action, which now targets `served` (with the
  new trigger promoting it to `completed` immediately whenever payment
  is already settled).
- **Who triggers deferred Stripe/VNPay payment**: the customer, from
  their own order-tracking page — not staff-initiated.

## Revision (same day, post-implementation): payment method also deferred for Pay Later

The initial implementation still asked for a payment **method**
(Cash/Stripe/VNPay) at checkout even for Pay Later, only deferring
*when* it was collected. That's wrong — for Pay Later, the method
itself should also be chosen at the end, not the start. Corrected
design:

- **Checkout** only asks Pay Now vs Pay Later. If **Pay Now**, the
  Payment Method picker appears immediately, exactly as before —
  unchanged. If **Pay Later**, no Payment Method picker appears at
  all — the order is placed with `payment_method = null`.
- **`orders.payment_method` becomes nullable** (was `not null`) — a
  new migration drops the constraint. `place_order` now requires a
  method only when `payAt = 'now'`; for `payAt = 'later'` it's
  optional and typically omitted.
- **Choosing the method later**: once an order is `served` with
  `payment_status = 'pending'` and `payment_method` still null, either
  side can set it:
  - **Customer**, from their tracking page — a 3-way picker
    (Cash/Card/VNPay) replaces the old single "Pay Now" button when no
    method is chosen yet. Picking Cash just records the choice (staff
    collects it in person, no redirect); picking Stripe/VNPay records
    the choice *and* immediately redirects to that gateway's checkout,
    same as before.
  - **Staff**, from the table's card in the KDS Tables column — but
    **cash only**. Stripe/VNPay require the customer's own device to
    complete a hosted checkout; staff has no way to finish that flow on
    the guest's behalf, so the table card's method picker only offers
    "Mark Cash" (a plain update, staff already has row-level UPDATE
    rights via `orders_update_staff`) — Stripe/VNPay stay customer-only.
  - Both paths converge on the same already-built mechanics once a
    method is known: Cash → existing "Confirm Cash Received" flow;
    Stripe/VNPay → existing `pay-order` Edge Function checkout-session
    creation.
- The `pay-order` Edge Function's payload gains a required
  `paymentMethod` field (it now *sets* the order's method rather than
  reading a pre-existing one) and its response becomes `{ checkoutUrl?:
  string }` — present for Stripe/VNPay, absent for Cash (nothing to
  redirect to).
- Every `paymentMethod`-typed field touched by the original
  implementation (`OrderRow`, `OrderForTracking`, `TrackingJson`,
  `KdsOrderRow`, and the Staff Order History types for consistency)
  widens from `"stripe" | "cash" | "vnpay"` to `"stripe" | "cash" |
  "vnpay" | null`.
