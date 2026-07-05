# Today: POS connected to Kitchen Display, shared real table list

## Task

User asked to check the logic of the staff pages after the KDS review.
Reading `pos-terminal.tsx` surfaced two real gaps: POS had its own
hardcoded 3-table list separate from the shared `useTables()` hook, and a
charged POS order never reached the Kitchen Display board (disconnected
mock-data islands, same issue as Checkout→KDS). Fixed both.

## Context

- Full details: `continuity.md` ("POS ↔ Kitchen Display connected, real
  tables shared" section), `CLAUDE.md` (under "Staff pages")
- New: `hooks/useKitchenOrders.tsx` (Context+Provider, moved out of
  `kitchen-board.tsx`/`kitchen-display.tsx`)
- Changed: `components/staff/pos-terminal.tsx` (table dropdown now uses
  `useTables()`; "Charge" calls `addOrder()`), `kitchen-board.tsx` /
  `kitchen-display.tsx` / `kitchen-stats-footer.tsx` (import types/state
  from the new shared hook), `app/[locale]/staff/layout.tsx` (mounts
  `KitchenOrdersProvider`)

## Done when

- `npm run build` succeeds, no type errors — done
- curl confirms `/staff/pos` and `/staff/orders` both still render, and
  the `/staff/*` auth gate is unaffected — done
- Ringing up a dine-in order at POS now pushes a real ticket onto the KDS
  "New" column with the correct table number — done by code review; not
  click-tested in a real browser (no browser automation tool available in
  this environment, standing caveat)

## Next up (in progress)

User also asked to check Admin Menu Management against its Stitch mockup
(`13-admin-menu.html`) — starting that review now.
