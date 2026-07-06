# Today: Real Table data + Realtime shipped (2nd "make all data real-time" sub-project)

## Task

Continued the "make all data real-time" project (decomposition:
Inventory → Tables → Orders → Staff accounts). This session shipped
Tables — full cycle again: brainstorm → spec → plan → inline execution →
live verification → docs. Inventory (shipped earlier today) recap is
below for continuity, then Tables.

## Done today

### Real Inventory data + Realtime (shipped, first sub-project)

See the previous commit history / CLAUDE.md's "Admin pages" section for
full detail — summary: `ingredients`/`inventory_logs` (already-applied
schema) got bilingual columns, an atomic `adjust_ingredient_stock` RPC,
and Realtime; new Add/Edit Ingredient UI; admin-configurable recipes
(`menu_item_ingredients`/`modifier_ingredients`) for both menu items and
extras. 10 plan tasks, all shipped and verified live.

### Real Table data + Realtime (shipped, second sub-project)

Spec: `docs/superpowers/specs/2026-07-06-tables-realtime-design.md`.
Plan: `docs/superpowers/plans/2026-07-06-tables-realtime.md` (7 tasks +
one mid-verification fix, executed inline on `main`).

- **Big discovery, same pattern as Inventory**: `public.tables` (migration
  `0005_orders.sql`) already existed with RLS and was already wired as
  `orders.table_id`'s FK target. Gap: no bilingual/occupied/scan columns,
  no admin UI, no Realtime.
- **A real RLS wrinkle Inventory didn't have**: scan-count tracking must
  be writable by an anonymous guest (scanning a QR code has no login at
  all), but `tables_admin_all` is manager/admin-only. Solved with
  `increment_table_scan_count` as the one `security definer` function in
  this project (vs. every other RPC using `security invoker`), scoped
  narrowly enough that it can't be used to rename/relocate/re-token a
  table — verified live with a fresh, logged-out browser context that a
  real scan increments `scan_count` with zero authentication.
- **Caught and fixed a real design flaw during spec self-review, before
  writing the plan**: an earlier draft assumed `activeTable` (a
  customer's "which table am I ordering at" session) could drop its
  `localStorage` persistence now that its source data is real. Wrong —
  that persistence exists specifically so `activeTable` survives a VI/EN
  locale switch (which remounts every provider), the same bug class that
  hit `useInventory.tsx` two sessions ago. Fixed the spec before it
  became a real regression; verified live that `localStorage`'s
  `phadincoffee-active-table` value survives a full page reload with all
  fields intact.
- **Caught a real bug in `pos-terminal.tsx` before it shipped**: its
  `selectedTableId` state initializes from `tables[0]?.id` once at
  mount — with real async-loaded `tables` starting as `[]`, the
  `<select>` would render with no visible selection even though the
  underlying logic still resolved correctly via an existing fallback.
  Fixed with a one-line `useEffect` sync.
- **Found and fixed a real gap mid-plan-writing (not by the plan
  itself)**: the plan as first written had no seed migration for tables
  — caught only when Task 7's live verification showed Admin Tables with
  zero table cards instead of the original 6. Added migration
  `0013_seed_tables_data` on the spot to seed the 6 original mock tables
  as real rows.
- New admin UI: real "+ Add Table" modal
  (`components/admin/table-form.tsx`) — a real `table_number unique`
  constraint means collisions (on add *or* rename) now surface a real
  inline error instead of a mock auto-increment that could never
  collide. Verified live via Playwright (two admin sessions): add,
  rename (including a deliberate collision), occupied toggle, and QR
  regeneration all sync live across sessions within about a second.
- **New gap found and documented, correctly left out of scope**:
  `checkout-view.tsx`'s `orderType` state reads `activeTable` only once
  at first render — a pre-existing race (identical pattern existed in
  the old mock hook too) that can default to "pickup" even when
  `activeTable` becomes populated moments later after a full reload.
  Confirmed this predates today's work; noted in CLAUDE.md as a small
  follow-up for whenever Checkout itself is revisited, not fixed here.
- ESLint baseline stayed at the documented 5 pre-existing
  `react-hooks/set-state-in-effect` errors — composition shifted
  (`table-landing.tsx` dropped off the list as a side effect of its
  async rewrite; `pos-terminal.tsx`'s new one-line sync effect joined it,
  same legitimate pattern class as the others, no suppression used
  anywhere in this codebase for this rule).
- All 8 commits (schema, seed, query layer, hook rewrite, 2 consumer
  fixes, admin UI, mid-verification seed fix) pushed and deployed.
  33/33 tests passing.

## Next session starts here

1. **Sub-project #3: Orders** — the biggest slice. Unifies customer
   Checkout/Tracking/History (`hooks/useOrders.tsx`) with staff POS/
   Kitchen Display (`hooks/useKitchenOrders.tsx`) — currently two
   separate mock systems that don't talk to each other (a customer's
   Checkout order never reaches the Kitchen Display board). The real
   `orders`/`order_items`/`order_item_modifiers` schema (migration
   `0005_orders.sql`) already exists with RLS, and migration
   `0007_handle_order_paid.sql` already has the inventory-deduction
   trigger from the Inventory sub-project ready to fire the moment real
   order placement exists — likely the "big discovery" pattern will hold
   again. This needs a real design discussion (single `orders` table
   driving both customer tracking and staff KDS) and should probably
   also account for the still-stubbed `place-order` Edge Function, since
   atomic stock decrement + payment handling both live there.
2. After Orders: **Staff accounts** (`components/admin/staff-accounts.tsx`'s
   local mock array → real `profiles` queries).
3. Small documented follow-up, not urgent: `checkout-view.tsx`'s
   `orderType` should re-derive from `activeTable` reactively instead of
   only at first mount (see CLAUDE.md's Table identity flow section).
4. Two throwaway test accounts (staff/customer roles) exist in the live
   Supabase project — credentials in `.env.local` and the gitignored
   `test-accounts.md` at the repo root.
5. `next build` still prints the "middleware deprecated, use proxy"
   warning (Next.js 16.2.10). Not urgent.
