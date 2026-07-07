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
2. A table automatically frees up once **all** of its active orders are
   done (`completed` or `cancelled`) — not on the first order finishing,
   since a table can have more than one order open at once (e.g. a
   second round ordered before the first is served).
3. Table status is visible at a glance in the Kitchen Display, as a
   literal 4th board column next to New/Preparing/Ready (not a sidebar
   or footer strip — confirmed directly by the user after two other
   layouts were rejected).
4. Table status is visible in the Admin Dashboard as a new card,
   matching the dashboard's existing card style, backed by real-time
   data (not mock).

## Non-goals

- Removing the existing manual "toggle occupied" control in Admin →
  Tables (`hooks/useTables.tsx`'s `toggleOccupied`). It stays as a
  manual override for cases the trigger can't see (e.g. a walk-in
  seated without placing an order yet, or an admin correcting a stuck
  state).
- Any change to POS's dine-in flow beyond what already sets `table_id`
  on the order — POS already collects `table_id` via `place_order`.
- A full occupancy history/audit table. Only the current
  `tables.is_occupied` boolean is targeted, as today.

## Design

### 1. Auto-occupancy: a DB trigger, not application code

Business logic belongs in Postgres here for the same reason
`handle_order_paid` (migration `0007`) is a trigger, not application
code: multiple independent code paths create/update orders — the
`place_order` RPC (customer checkout, guest and logged-in), POS, and
`cancel_pending_order` (guest self-cancel). A trigger on `orders` fires
identically no matter which path touches the row, so there's exactly
one place this logic can drift from "always correct."

**New migration `0021_table_occupancy_sync.sql`:**

```sql
create or replace function public.sync_table_occupancy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.order_type = 'dine_in' and new.table_id is not null then
      update public.tables set is_occupied = true where id = new.table_id;
    end if;
    return new;
  end if;

  -- tg_op = 'UPDATE': only act on a transition INTO a terminal status
  if new.table_id is not null
     and new.status in ('completed', 'cancelled')
     and old.status not in ('completed', 'cancelled') then
    if not exists (
      select 1 from public.orders
      where table_id = new.table_id
        and status not in ('completed', 'cancelled')
        and id <> new.id
    ) then
      update public.tables set is_occupied = false where id = new.table_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_order_table_occupancy on public.orders;
create trigger on_order_table_occupancy
  after insert or update of status on public.orders
  for each row
  execute function public.sync_table_occupancy();
```

`security definer` matches `handle_order_paid`'s existing precedent
(guests placing orders don't have UPDATE rights on `tables` directly).
`for each row` + the `old.status not in (...)` guard means the "any
other active order for this table?" check only runs once per
order-reaching-terminal-status, not on every unrelated order update.

Pickup orders (`table_id is null`) never touch this trigger — both
branches short-circuit on `table_id is not null`/`order_type =
'dine_in'`.

### 2. Kitchen Display: literal 4th board column

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
  red/green convention already used in the original brainstorm mockup.
  No per-order detail, no actions — this column is read-only status,
  the "Done"/advance buttons stay on the order cards in the other three
  columns exactly as they are today.
- New translation keys: `KitchenDisplay.columnTables`, `.tableFree`,
  `.tableOccupied` (both `messages/en.json` and `messages/vi.json`).

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
flips true; advance it to completed via KDS, confirm it flips false;
place two dine-in orders at the same table, complete one, confirm it
stays occupied until the second is also completed/cancelled.

No new query-layer module is needed (both UIs reuse `useTables()`
as-is), so no new Vitest file is required beyond what already covers
`tables-data.ts`.

## Open questions resolved during brainstorming

- **Both ends automatic** (occupy on order, free on completion) —
  confirmed by user over "occupy automatic, free manual."
- **Free only when ALL active orders at that table are done** — confirmed
  over "free as soon as any one order at that table completes."
- **KDS layout: literal 4th column**, not a sidebar panel or footer
  strip — confirmed by user after two rejected alternatives.
