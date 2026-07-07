# Table Status: Occupancy + Cleaning Workflow — Design

## Problem

`tables.is_occupied` (migration `0012`) is a manual admin-only boolean.
It has no connection to orders at all, and it can't express a real
restaurant floor's actual states — a table isn't just "in use" or
"free," there's a third state in between: served and vacated, but not
yet reset for the next guest.

## Goals

1. Placing a dine-in order automatically marks its table **Occupied**
   — this happens the moment the order is created (sent to kitchen),
   regardless of whether payment has been confirmed yet.
2. When a table's **last active order** finishes (`completed` or
   `cancelled`), the table automatically moves to **Cleaning** — never
   straight to Available. "Order finished" (food served, or the
   transaction otherwise ended) is not the same event as "table reset
   and ready for the next guest."
3. Staff or admin move a table from Cleaning to Available with a single
   tap — "Cleaning Done" — available from two surfaces: the new KDS
   Tables column, and the existing Admin Tables page.
4. While a table is Cleaning, a guest scanning its QR code sees a
   "this table is being cleaned" message instead of the normal
   ordering flow, with a "Notify staff" button — for the case where no
   one has come to clean it yet.
5. Table status is visible at a glance in the Kitchen Display, as a
   literal 4th board column next to New/Preparing/Ready (confirmed via
   a persisted Stitch mockup,
   `projects/4654820544595168289/screens/64f4bd2f4eec41e392bf1f85be18eb3c`),
   with per-table status and the relevant action button.
6. Table status is visible in the Admin Dashboard as a new card, live
   via Realtime.

## Non-goals

- Push notifications, SMS, or any channel besides an in-app flag —
  "Notify staff" sets a flag visible on the table's own card in KDS and
  Admin; there's no external alert.
- Escalation, timers, or auto-reassignment if a cleaning notification
  goes unacknowledged.
- Distinguishing *why* a table needs cleaning (food actually served vs.
  every order for that table happened to be cancelled). Both cases
  route through Cleaning uniformly — seeing an all-cancelled table go
  through one extra "Cleaning Done" tap is a small cost, and it avoids
  the DB trigger having to reconstruct "was anything from this
  occupancy period actually completed" without a session concept.
- Removing the existing Admin Tables manual control — it's upgraded to
  a 3-state contextual action (Section 6) rather than removed.
- A full occupancy history/audit table. Only the current `tables`
  status is targeted, as today.

## Design

### 1. Data model: `tables.status` enum replaces `is_occupied` boolean

A boolean can't hold three states. Migration `0021_table_status.sql`:

```sql
create type public.table_occupancy_status as enum ('available', 'occupied', 'cleaning');

alter table public.tables add column status public.table_occupancy_status not null default 'available';
update public.tables set status = case when is_occupied then 'occupied' else 'available' end;
alter table public.tables drop column is_occupied;

alter table public.tables add column cleaning_notified_at timestamptz;
```

`cleaning_notified_at` backs Goal 4 — null means no pending
notification; a timestamp means a guest tapped "Notify staff" and no
one has cleared it yet (cleared automatically when the table moves
back to Available).

`lib/supabase/tables-data.ts` changes: `TableRecord.isOccupied: boolean`
becomes `TableRecord.status: "available" | "occupied" | "cleaning"` and
`TableRecord.cleaningNotifiedAt: string | null`; `TableRow`/`mapTableRow`/
`TABLE_SELECT` updated to match; `setTableOccupied(supabase, id,
isOccupied: boolean)` is replaced by `setTableStatus(supabase, id,
status: TableOccupancyStatus)` (a plain update, same shape as the
function it replaces).

### 2. DB triggers: occupy automatic, cleaning automatic, available always manual

Same rationale as `handle_order_paid` (migration `0007`) for using a
trigger, not application code: multiple independent code paths create
and complete orders (`place_order` RPC, POS, `cancel_pending_order`,
KDS's `advance()`). A trigger fires identically no matter which path
touches the row.

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
      update public.tables
      set status = 'occupied', cleaning_notified_at = null
      where id = new.table_id;
    end if;
    return new;
  end if;

  -- tg_op = 'UPDATE': a transition INTO a terminal status
  if new.table_id is not null
     and new.status in ('completed', 'cancelled')
     and old.status not in ('completed', 'cancelled') then
    if not exists (
      select 1 from public.orders
      where table_id = new.table_id
        and status not in ('completed', 'cancelled')
        and id <> new.id
    ) then
      update public.tables set status = 'cleaning' where id = new.table_id;
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

Pickup orders (`table_id is null`) never touch this trigger. A second
dine-in order placed at an already-`cleaning` table (someone seated
before staff caught up) forces it back to `occupied` and clears
`cleaning_notified_at` — the INSERT branch is unconditional on current
status, which is the correct behavior for that edge case.

**Available is never set by a trigger** — only by the manual "Cleaning
Done" action in Section 5/6, which is the one place `status =
'available'` is written by application code.

### 3. Guest-safe RPC: `notify_table_cleaning`

Matches this project's guest-safe RPC pattern (a narrow `security
definer` function keyed by the row's own id, not a broad RLS policy) —
a guest on the table-landing page has no role and needs to flag a
table without being able to touch anything else.

```sql
create or replace function public.notify_table_cleaning(
  p_table_id uuid
) returns public.tables
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.tables;
begin
  update public.tables
    set cleaning_notified_at = now()
    where id = p_table_id and status = 'cleaning'
    returning * into v_row;

  if v_row.id is null then
    raise exception 'table % not found or not cleaning', p_table_id;
  end if;

  return v_row;
end;
$$;

revoke all on function public.notify_table_cleaning(uuid) from public;
grant execute on function public.notify_table_cleaning(uuid) to anon, authenticated;
```

The `status = 'cleaning'` guard in the `WHERE` clause means this RPC is
a no-op error for any table not currently in Cleaning — a guest can't
use it to flag an Available or Occupied table.

### 4. Table QR landing: blocked ordering + Notify Staff while Cleaning

`components/customer/table-landing.tsx` currently has two branches
(invalid token / valid table → "View Menu"). Adds a third: when
`resolvedTable.status === "cleaning"`, show a distinct message ("This
table is being cleaned") instead of the menu button, plus a "Notify
staff" button calling the new `notifyTableCleaning` query-layer
function. After a successful call, the button becomes disabled with a
"Staff notified" confirmation (local state, matching the existing
`resolvedTable` state pattern in this component — no need to
re-resolve the table just to reflect this).

Available and Occupied both keep today's behavior unchanged (ordering
allowed at an occupied table always has been — this was never gated on
occupancy, and stays that way; multiple rounds at one table is normal).

### 5. Kitchen Display: literal 4th board column, 3-state actionable cards

Same structural change as before — `kitchen-board.tsx`'s grid goes
`md:grid-cols-3` → `md:grid-cols-4`, a new "Tables" section sourced
from `useTables()` (already Realtime via the app-wide `TablesProvider`).

Each table card is now driven by `status` with three visual/action
states:
- **Available** — green/muted badge, no action.
- **Occupied** — red/primary badge, no action (the trigger handles the
  transition out of this state automatically).
- **Cleaning** — amber badge, **"Cleaning Done" button** (calls
  `setTableStatus(supabase, id, "available")`, same function Admin
  Tables uses). If `cleaningNotifiedAt` is set, the card additionally
  shows an urgent visual treatment (e.g. a pulsing dot + "Guest
  notified staff" caption) so a pending guest notification is visibly
  different from a table that's merely mid-cleaning.

New translation keys: `KitchenDisplay.columnTables`, `.available`,
`.occupied`, `.cleaning`, `.cleaningDone`, `.guestNotified` (both
`messages/en.json` and `messages/vi.json`).

### 6. Admin Tables: 3-state contextual action replaces the toggle

`components/admin/tables-management.tsx`'s existing single toggle
button (`toggleOccupied`, binary) becomes a contextual button matching
the KDS card's per-state labeling, calling the same new
`setTableStatus`:
- Available → button reads "Mark Occupied" → sets `occupied` (manual
  override for a walk-in seated without an order yet).
- Occupied → button reads "Mark Cleaning" → sets `cleaning` (manual
  override, e.g. staff clearing a table early).
- Cleaning → button reads "Cleaning Done" → sets `available` (same
  action as the KDS card's button).

The page's existing "Available" stat count is computed from
`status === "available"` instead of `!isOccupied`; add a "Cleaning"
stat alongside it (same card style as the existing three stat cards).

### 7. Admin Dashboard: "Table Status" card

Same as originally scoped — a new card in `dashboard-view.tsx`, real
Realtime data via `useTables()`, inserted after the Inventory Status
table. Now shows three-way counts (Available / Occupied / Cleaning)
instead of two, and if any table has `cleaningNotifiedAt` set, an
"X table(s) need cleaning attention" badge in the same destructive/
alert style already used for the Inventory Status card's low-stock
count.

### 8. Testing

Trigger and RPC are Postgres functions — per this project's
established convention (no Deno/pg test harness), verified live:
place a dine-in order, confirm `status` flips to `occupied`; complete
that order via KDS, confirm it flips to `cleaning` (not `available`);
tap "Cleaning Done" in the KDS Tables column, confirm it flips to
`available`; place two dine-in orders at one table, complete one,
confirm it stays `occupied` until the second is also finished; scan a
`cleaning` table's QR as a guest, confirm the blocked message and
working "Notify staff" button, and confirm the KDS/Admin cards show
the "guest notified" treatment afterward.

`lib/supabase/tables-data.ts` gets updated unit tests (replacing the
`isOccupied`-based fixtures in `tables-data.test.ts`) for
`mapTableRow`'s new `status`/`cleaningNotifiedAt` fields and for
`setTableStatus`'s RPC call shape — following the existing DI'd,
mocked-client pattern already used throughout that test file.

## Open questions resolved during brainstorming

- **Occupy automatic (on order placement), Cleaning automatic (on last
  active order finishing), Available always manual** — this is the
  final three-state model, replacing two earlier framings: "both ends
  automatic" (binary), and then "occupy automatic / free manual"
  (binary, no cleaning step) once "order completed" vs. "guest left"
  was disambiguated. The user's final instruction added the explicit
  Cleaning state in between.
- **KDS layout: literal 4th column**, not a sidebar panel or footer
  strip — confirmed after two rejected alternatives, then verified live
  in a persisted Stitch mockup.
- **Guests can notify staff while a table is stuck in Cleaning** — a
  new requirement added in the same message that introduced the
  Cleaning state; scoped to an in-app flag only (see Non-goals).
