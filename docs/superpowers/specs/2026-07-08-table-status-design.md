# Table Status: Auto-Occupancy + KDS/Admin Visibility — Design

## Problem

`tables.is_occupied` (migration `0012`) is a manual admin-only toggle. It
has no connection to orders at all — placing a dine-in order doesn't mark
a table occupied, and completing that order doesn't free it back up.
Staff and admin also have no at-a-glance view of which tables are
currently in use; that information only exists in Admin → Tables, one
row at a time.

## Goals

1. Placing a dine-in order automatically marks its table occupied.
2. Freeing a table is a **manual staff action**, not automatic on order
   completion. "Order completed" means *food served/picked up* — it
   does not mean the guest has physically left the table, and the app
   has no way to observe that. Staff tap "Mark Available" on the
   table's own card once the guest actually leaves. (This revises an
   earlier "both ends automatic" framing from initial brainstorming —
   confirmed with the user directly once the "done" ambiguity was
   surfaced.)
3. Table status is visible at a glance in the Kitchen Display, as a
   literal 4th board column next to New/Preparing/Ready (not a sidebar
   or footer strip — confirmed directly by the user after two other
   layouts were rejected), and occupied tables there are directly
   actionable (tap to mark available) — not read-only.
4. Table status is visible in the Admin Dashboard as a new card,
   matching the dashboard's existing card style, backed by real-time
   data (not mock).

## Non-goals

- Removing the existing manual "toggle occupied" control in Admin →
  Tables (`hooks/useTables.tsx`'s `toggleOccupied`). It's now one of
  two places staff can free a table (the other being the new KDS
  Tables column) — both call the same existing function, no duplicate
  logic.
- Detecting that a guest has physically left (no check-out flow,
  no timer, no proximity/QR-based signal). Freeing a table is always an
  explicit staff tap — this is a deliberate scope boundary, not a gap.
- Any change to POS's dine-in flow beyond what already sets `table_id`
  on the order — POS already collects `table_id` via `place_order`.
- A full occupancy history/audit table. Only the current
  `tables.is_occupied` boolean is targeted, as today.

## Design

### 1. Auto-occupancy: a DB trigger, not application code (INSERT only)

Business logic belongs in Postgres here for the same reason
`handle_order_paid` (migration `0007`) is a trigger, not application
code: multiple independent code paths create orders — the `place_order`
RPC (customer checkout, guest and logged-in) and POS. A trigger on
`orders` fires identically no matter which path touches the row, so
there's exactly one place this logic can drift from "always correct."

Only the **occupy** side is a trigger. The **release** side is
deliberately not — see Section 2, it's a manual staff action.

**New migration `0021_table_occupancy_sync.sql`:**

```sql
create or replace function public.sync_table_occupancy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.order_type = 'dine_in' and new.table_id is not null then
    update public.tables set is_occupied = true where id = new.table_id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_order_table_occupancy on public.orders;
create trigger on_order_table_occupancy
  after insert on public.orders
  for each row
  execute function public.sync_table_occupancy();
```

`security definer` matches `handle_order_paid`'s existing precedent
(guests placing orders don't have UPDATE rights on `tables` directly).

Pickup orders (`table_id is null`) never touch this trigger — it
short-circuits on `order_type = 'dine_in'`.

### 2. Kitchen Display: literal 4th board column, tables are actionable

`components/staff/kitchen-board.tsx` currently renders a
`grid-cols-1 md:grid-cols-3` of order-status columns (`COLUMNS` array:
New/Preparing/Ready). This adds a 4th `<section>`, visually consistent
with the other three (same rounded-xl/border/header treatment) but
**not** part of the `COLUMNS.map` loop, since it isn't order-status
driven — it lists tables, not orders, sourced from the already-available
`useTables()` hook (the whole locale layout is already wrapped in
`TablesProvider`, confirmed in `app/[locale]/layout.tsx`, and it's
already Realtime — no new subscription needed).

- Grid changes from `md:grid-cols-3` to `md:grid-cols-4`.
- New column header: gray/neutral (not tied to an order-status color),
  labeled `t("columnTables")`.
- Body: one compact card per table (table number + location), color-
  coded — green/muted for free, red/primary for occupied — matching the
  red/green convention already used in the original brainstorm mockup
  and the Stitch KDS Board mockup (`projects/4654820544595168289/screens/
  64f4bd2f4eec41e392bf1f85be18eb3c`).
- **Occupied cards get a "Mark Available" button**; free cards show no
  action (already free). Tapping it calls the *same* `toggleOccupied`
  the Admin Tables page already uses (`hooks/useTables.tsx`) — no new
  RPC, no new query-layer function, just the existing action exposed
  from a second surface. This is the deviation from the Stitch mockup
  (which rendered the cards read-only) — the mockup's visual style is
  otherwise followed as-is, just with the button added to occupied
  cards.
- New translation keys: `KitchenDisplay.columnTables`, `.tableFree`,
  `.tableOccupied`, `.markAvailable` (both `messages/en.json` and
  `messages/vi.json`).

### 3. Admin Dashboard: new "Table Status" card

`components/admin/dashboard-view.tsx` gets one new card, inserted after
the existing Inventory Status table, in the same
`rounded-xl border bg-card p-5 shadow-sm` style as the KPI/Inventory
cards above it. Contents:

- Header: "Table Status" + a live "X / Y occupied" count.
- A compact grid of table chips (table number, occupied/free color
  coding — same convention as the KDS column), sourced from the same
  `useTables()` hook — already real, already Realtime, no new data
  layer needed.

This directly replaces the "no table-status surface in Admin Dashboard"
gap; it does not touch the still-mock revenue/orders/loyalty KPIs above
it (that's the separately queued third feature).

### 4. Testing

`sync_table_occupancy()` is a Postgres trigger function — per this
project's established convention (no Deno/pg test harness), it's
verified live: place a dine-in order, confirm `tables.is_occupied`
flips true; advance that order all the way to completed via KDS,
confirm the table **stays occupied** (no auto-release); tap "Mark
Available" on the table's card in the new KDS Tables column, confirm
it flips free; repeat via the existing Admin Tables toggle to confirm
both surfaces stay in sync (same underlying function, Realtime-synced).

No new query-layer module is needed (both UIs reuse the existing
`useTables()`/`toggleOccupied` as-is), so no new Vitest file is
required beyond what already covers `tables-data.ts`.

## Open questions resolved during brainstorming

- **Occupy automatic, free manual** — revised from an initial "both ends
  automatic" framing once the user clarified that "order completed"
  (food served) is not the same event as "guest physically left."
  Freeing a table is always an explicit staff tap, from either the new
  KDS Tables column or the existing Admin Tables toggle.
- **KDS layout: literal 4th column**, not a sidebar panel or footer
  strip — confirmed by user after two rejected alternatives, then
  verified live in a persisted Stitch mockup
  (`projects/4654820544595168289/screens/64f4bd2f4eec41e392bf1f85be18eb3c`).
- **KDS table cards are actionable** (tap to mark available), not
  read-only status-only — confirmed once the manual-release decision
  was made.
