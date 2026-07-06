# Staff Order History — Design Spec

**Date:** 2026-07-07
**Status:** Approved, ready for implementation planning.

## Context

`components/staff/kitchen-sidebar.tsx` has a disabled, tooltipped "Order
History" nav item (`title="Not implemented yet — no staff-facing order
history route"`) sitting next to the real "Live Orders" (Kitchen Display
board) link. This spec builds the real route behind it.

This is a different feature from the customer-facing Order History
(`components/customer/order-history.tsx`, reads `useOrders()`'s
`getMyOrders()`) — that page shows one customer's own orders. Staff need
to see **every** order, primarily to look a specific one up (a customer
asks about their order, or staff needs to re-check what was ordered/paid),
not to browse a live board (that's what the Kitchen Display board already
does for active orders).

### What already exists

- `orders`/`order_items`/`order_item_modifiers` (migration `0005`, RLS
  applied) — `orders_select_staff` already lets any staff/manager/admin
  session `select` every order row (not just their own), and
  `profiles_select_staff` does the same for `profiles`. No new RLS is
  needed for this feature.
- `order_status` enum: `pending_payment | paid | preparing | ready |
  completed | cancelled`. `payment_method` enum: `stripe | cash | vnpay`.
- `lib/supabase/orders-data.ts` already has the query-layer pattern to
  follow (`getKitchenOrders`, `getPendingPaymentOrders` — plain
  unfiltered-by-customer `.from("orders").select(...)` calls, relying on
  `orders_select_staff` rather than a client-side filter) and the
  `ORDER_SELECT` join shape (`tables(table_number)`,
  `order_items(...menu_items(...))`) to extend from.
- `formatOrderId()` (`lib/format.ts`) — added just before this spec,
  shortens a full UUID to its first 8 hex characters, uppercased, for
  display (`#A1B2C3D4`). Already wired into every existing order-id
  display site (Order Tracking, Order History, Kitchen Board, Pending
  Payment list).
- **A real gap found while researching this spec:** the customer-facing
  `get_order_for_tracking()` RPC (migration `0014`) only returns a row
  when `customer_id = auth.uid()` or `customer_id is null` (guest) — it
  has no staff/manager/admin bypass. It **cannot** be reused for this
  feature's detail page. The detail page instead uses a plain RLS-gated
  table select (see below), which staff can already do without touching
  that customer-facing function at all.
- A Stitch mockup for the list page was generated in this pass (project
  `4654820544595168289`, screen `6a268dd335ce45099f557f8260cb1527`, design
  system `assets/7846627771704298063`), matching the existing "KDS Board"
  desktop screen's sidebar/top-bar conventions — approved before writing
  this spec.

## Scope

One implementation plan. In scope: a new SQL search function, its query-
layer wrapper, a list page + detail page, and wiring the sidebar's
existing disabled link to the real route.

**In scope:** search/filter/paginate completed+cancelled orders; a detail
page per order; Realtime refresh of the list; the sidebar nav link.

**Out of scope:**
- Any change to `get_order_for_tracking()` or the customer Order History
  page — this is a separate, staff-only surface.
- A POS nav entry to this page (per your answer, reachable from the
  Kitchen Display sidebar only for now — POS's `staff-nav.tsx` is
  untouched).
- A sequential human-readable order number (`order_number` column) to
  replace the UUID-prefix short id — bigger schema change touching every
  existing id-display site; the existing `formatOrderId()` short id is
  reused as-is for search.
- CSV export, printing, or refunds/cancellation actions from this page —
  it's read-only lookup, not an actions surface (cancelling/refunding
  already has its own path elsewhere in the app).

## Architecture

### 1. Migration — `get_order_history()` search function

New migration `00XX_staff_order_history_fn.sql` (actual number assigned
at implementation time, after the latest applied migration):

```sql
create or replace function public.get_order_history(
  p_date_from date default null,
  p_date_to date default null,
  p_statuses order_status[] default array['completed', 'cancelled']::order_status[],
  p_order_type order_type default null,
  p_search text default null,
  p_limit int default 20,
  p_offset int default 0
) returns json
language sql
security invoker
set search_path = public
as $$
  -- date_from/date_to default to the last 7 days when both are null;
  -- joins orders -> tables -> profiles; casts o.id::text for the
  -- short-id prefix match so ilike works on a uuid column; matches
  -- p_search against id prefix OR table_number OR profiles.full_name OR
  -- profiles.phone (one search box, staff doesn't pick which field);
  -- returns { rows: [...], totalCount: int } for pagination.
$$;
```

`security invoker`, not `definer` — unlike `get_staff_members()` (which
needs `definer` to read the protected `auth.users` schema),
`get_order_history()` only reads `orders`/`tables`/`profiles`, and RLS
already grants staff full read on all three via `orders_select_staff` /
`tables_select_all` / `profiles_select_staff`. No bypass is needed, so
none is used.

Default status filter (`completed`/`cancelled` only) is enforced inside
the function, not just the client, so a client bug can't accidentally
pull active orders that already live on the Kitchen Display board.
Default date range (last 7 days when both bounds are omitted) is also
enforced inside the function, so a client bug can't accidentally request
the entire table's history.

### 2. Query layer — `lib/supabase/orders-data.ts`

```ts
export type OrderHistoryFilters = {
  dateFrom?: string   // ISO date
  dateTo?: string     // ISO date
  statuses?: RealOrderStatus[]   // defaults to ["completed", "cancelled"] server-side
  orderType?: OrderType
  search?: string
}

export type OrderHistoryRow = {
  id: string
  createdAt: number
  orderType: OrderType
  table?: string
  customerName?: string   // undefined => "Guest"
  paymentMethod: "stripe" | "cash" | "vnpay"
  status: RealOrderStatus
  total: number
}

export async function getOrderHistory(
  supabase: SupabaseClient,
  filters: OrderHistoryFilters,
  page: { limit: number; offset: number }
): Promise<{ rows: OrderHistoryRow[]; totalCount: number }>   // via get_order_history() RPC

export async function getOrderHistoryDetail(
  supabase: SupabaseClient,
  orderId: string
): Promise<OrderForTracking & { paymentMethod: string; paymentStatus: string; customerName?: string } | null>
  // plain .from("orders").select(...).eq("id", orderId).single() —
  // RLS (orders_select_staff / profiles_select_staff) already permits
  // this for any staff/manager/admin session; no RPC needed.
```

### 3. Hook — `hooks/useOrderHistory.tsx`

A **plain custom hook, not a Context/Provider** — unlike
`useKitchenOrders`/`useInventory`/`useTables` (shared across sibling
components: POS+KDS, Dashboard+Inventory), nothing else in the app needs
this data. Wrapping it in a Context would be applying the shared-state
pattern where nothing is actually shared.

```ts
function useOrderHistory(filters: OrderHistoryFilters, page: number, pageSize: number)
// returns { rows, totalCount, isLoading, refetch }
```

- Fetches on mount and whenever `filters`/`page` change (search is
  debounced ~300ms upstream in the list component before it reaches this
  hook, so the hook itself doesn't need its own debounce logic).
- Subscribes to `postgres_changes` on `orders` with **no filter**, same
  "a column filter doesn't reliably combine with RLS-gated
  `postgres_changes`" reasoning already established by every other
  Realtime hook in this codebase (`useKitchenOrders`, `useOrders`,
  `useInventory`, `useTables`) — refetches the current page on any
  change.
- Changing filters resets `page` back to `1` (owned by the list
  component, not this hook, since page is passed in).

### 4. Routes & components

- `app/[locale]/staff/orders/history/page.tsx` — list page. Nested under
  the existing `/staff/orders` segment; already covered by the existing
  `/staff/*` middleware prefix rule (staff/manager/admin), no middleware
  change needed.
- `app/[locale]/staff/orders/history/[orderId]/page.tsx` — detail page.
  Calls Next's `notFound()` when `getOrderHistoryDetail` returns `null`
  (unknown/inaccessible id), same pattern as the Product Detail Page.
- `components/staff/order-history-list.tsx` (client) — debounced search
  box, date-range control (default "Last 7 days"), status filter
  (Completed/Cancelled/All), order-type filter (Pickup/Dine-in/All),
  results table (short id via `formatOrderId`, date/time, customer name
  or "Guest", table number or "Pickup", payment method icon, status
  badge, total via `formatVND`), pagination footer ("Showing X-Y of Z
  orders", Previous/Next), and an empty state ("No orders match your
  filters.") distinct from the loading skeleton. Matches the approved
  Stitch mockup's layout.
- `components/staff/order-history-detail.tsx` (client) — items with
  per-item notes/modifiers, subtotal/discount/total, payment method +
  payment status, customer name/phone or "Guest", table/order type, a
  back link to the list.
- `kitchen-sidebar.tsx` — the existing disabled "Order History" `button`
  becomes a real `Link` to `/staff/orders/history`, gaining the same
  active-highlight treatment "Live Orders" already has (`usePathname()`
  check), matching how `staff-nav.tsx` highlights the current tab.
- New translation namespace `StaffOrderHistory` in both
  `messages/vi.json`/`messages/en.json` — kept separate from the
  customer-facing `OrderHistory` namespace since labels genuinely differ
  (a "Customer" column, "Payment Method", filter labels) and sharing one
  namespace risks a copy change to one page silently affecting the other.

## Data Flow

1. Staff opens `/staff/orders/history` → `useOrderHistory` fetches page 1
   with default filters (last 7 days, completed+cancelled, all types, no
   search) → table renders.
2. Staff types in the search box → debounced ~300ms → hook refetches with
   `search` set, page reset to 1 → `get_order_history()` matches against
   id prefix / table number / customer name / phone in one round trip.
3. Staff clicks a row → navigates to `/staff/orders/history/[orderId]` →
   `getOrderHistoryDetail` fetches the full order via plain RLS-gated
   select → renders items/totals/payment/customer.
4. An order elsewhere transitions to `completed`/`cancelled` (e.g. staff
   advances it on the Kitchen Display board) → the unfiltered `orders`
   Realtime subscription fires → History's current page refetches → the
   newly-completed order appears if it falls within the active filters.

## Error Handling

- **Guest orders** (`customer_id is null`): `customerName` comes back
  `undefined`; both the list and detail page render "Guest" rather than
  a blank cell.
- **Invalid date range** (`from > to`): swapped automatically before the
  query runs, rather than surfacing a validation error for an easy honest
  mistake.
- **Empty results**: a distinct empty state, not a blank table indistinguishable from a loading state.
- **Detail page, unknown/inaccessible id**: `notFound()` → Next's 404,
  not a crash — shouldn't normally happen given RLS grants staff full
  read, but a stale/hand-edited URL should fail cleanly.
- **Realtime subscribe failure**: degrades to "fetched once, not live"
  with a `console.warn`, matching every other Realtime hook's convention
  in this codebase.

## Testing

- `lib/supabase/orders-data.test.ts` (extends the existing fake-Supabase-
  client test style already used for this module, if present, or
  establishes it): `getOrderHistory` calls the RPC with the right
  parameter shape (including the date-swap-on-invalid-range and
  default-statuses behavior), `getOrderHistoryDetail` issues the right
  `.eq("id", ...)` select and maps a guest row's `customerName` to
  `undefined`.
- A small pure function mapping UI filter state → RPC params (including
  the date-range default/swap logic) is extracted for a fast Vitest unit
  test, mirroring the existing `lib/middleware-rules.ts` extraction
  precedent — this is the one piece of this feature with real branching
  logic worth testing in isolation.
- Everything else verified manually against the live Vercel deployment
  (this app's established convention): search by short id/table
  number/customer name/phone, date range, status/order-type filters,
  pagination, Realtime update when an order completes elsewhere, the
  detail page's guest-vs-named-customer rendering, and the sidebar nav
  link's active-highlight state.

## Self-Review Notes

- Checked for placeholders/TBDs — none found (the migration's actual
  number is deferred to implementation time by convention, same as every
  prior spec in this repo — not a placeholder, a stated fact about
  sequencing).
- Checked internal consistency — the `security invoker`-vs-`definer`
  reasoning here (invoker, because RLS alone already covers every table
  this function touches) is stated once and doesn't contradict
  `get_staff_members()`'s `definer` reasoning in the prior spec (that one
  needs `definer` specifically to cross into the protected `auth` schema,
  which this feature never does).
- Checked scope — confirmed the customer-facing `get_order_for_tracking`
  gap is documented as found-but-untouched, not silently left inconsistent
  with this new staff path.
