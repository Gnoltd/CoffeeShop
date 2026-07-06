# Today: Real Inventory data + Realtime + admin-configurable recipes shipped

## Task

Kicked off the "make all data real-time" project (decomposed into
Inventory → Tables → Orders → Staff accounts). This session designed,
planned, and shipped the first sub-project: Inventory. Full cycle —
brainstorm → spec → plan → inline execution → live verification → docs.

## Done this session

### Real Inventory data + Realtime (shipped)

Replaced `hooks/useInventory.tsx`'s `localStorage` mock model with real
Supabase data and cross-session Realtime sync. Spec:
`docs/superpowers/specs/2026-07-06-inventory-realtime-design.md`. Plan:
`docs/superpowers/plans/2026-07-06-inventory-realtime.md` (10 tasks,
executed inline on `main`).

- **Big discovery before any design questions** (same pattern as last
  session's extras feature): `ingredients`/`inventory_logs`/
  `menu_item_ingredients`/`modifier_ingredients` (migration
  `0004_inventory.sql`) were already applied with RLS, and migration
  `0007_handle_order_paid.sql` already had a trigger that deducts stock
  and logs it when an order is paid — dead code today since real order
  placement doesn't exist yet, but already correct. The actual gap was
  narrower: no bilingual columns, no admin UI at all, and no Realtime.
- Migration `0010_inventory_i18n_and_stock_fn`: bilingual `name_vi`/
  `name_en`/`subtitle_vi`/`subtitle_en`/`icon` columns on `ingredients`,
  an atomic `adjust_ingredient_stock` RPC (`security invoker` — locks the
  row, clamps at 0, updates, logs, all in one round trip — replaces the
  old mock's client-side clamp-then-write, which was only safe with a
  single browser tab), and `ingredients`/`inventory_logs` added to the
  `supabase_realtime` publication. Migration `0011_seed_inventory_data`
  seeded the 4 mock ingredients as real rows through that same RPC.
- `lib/supabase/inventory-data.ts` — new query layer (DI'd like
  `menu-data.ts`, 7 unit tests): ingredients CRUD, `adjustStock`,
  `getInventoryLogs`, and recipe CRUD for both menu items
  (`menu_item_ingredients`) and modifiers (`modifier_ingredients`).
- `hooks/useInventory.tsx` rewritten: fetches once on mount, subscribes
  to `postgres_changes` on both tables. Mutation functions never call
  `setIngredients` themselves — the Realtime echo is the only code path
  that updates local state, including for the tab that made the change.
  Confirmed live via Playwright: two admin sessions, one adjusts stock,
  the other sees the new number and log entry within ~1 second, no
  reload.
- New admin UI: "+ Add Ingredient" + a per-row edit pencil
  (`components/admin/ingredient-form.tsx`) — ingredients are no longer a
  fixed set of 4.
- **Recipes are now real and admin-configurable.** New shared
  `components/admin/recipe-checklist.tsx` (checkbox + quantity input per
  ingredient), used in two places:
  - A new "Recipe" section in the menu item Add/Edit form
    (`menu_item_ingredients`).
  - Extras (shipped last session with create-only UI) gained their first
    **edit** affordance — a pencil per extra opens an inline panel to
    change name/price and the extra's own ingredient usage
    (`modifier_ingredients`). Needed a new `updateModifierGroup` in
    `menu-data.ts`.
  - Verified both persist correctly across reopen and in the DB directly.
    Also verified no regression on the customer Product Detail Page: an
    edited extra's new price correctly changes the running total when
    selected/deselected.
- ESLint baseline actually **improved**: the old hydrate-in-effect
  pattern in `useInventory.tsx` (added last session as a stopgap for the
  locale-switch-resets-state bug) is gone entirely now that Supabase +
  Realtime is the real persistence/sync layer — back down to the
  documented 5 pre-existing `react-hooks/set-state-in-effect` errors,
  down from 6.
- All 10 plan tasks committed separately, pushed, deployed, verified live
  on `https://phadincoffee.vercel.app`. 27/27 tests passing.

## Next session starts here

1. **Sub-project #2: Tables.** `hooks/useTables.tsx` (table list, QR
   tokens, active session, occupied/scan-count) → a real `tables` table +
   RLS + Realtime. Would also fix the documented gap where regenerating a
   QR token doesn't invalidate an already-active client-side session.
   Start with a brainstorm, same cycle as Inventory (design questions:
   does `tables` need bilingual location columns like ingredients did;
   does the QR-token regeneration gap get fixed as part of this or stay
   deferred).
2. After Tables: **Orders** (the biggest slice — unifying customer
   Checkout/Tracking/History with staff POS/Kitchen Display into one real
   `orders` schema + Realtime), then **Staff accounts**.
3. Two throwaway test accounts (staff/customer roles) exist in the live
   Supabase project — credentials in `.env.local`
   (`TEST_STAFF_EMAIL`/`TEST_STAFF_PASSWORD`,
   `TEST_CUSTOMER_EMAIL`/`TEST_CUSTOMER_PASSWORD`) and the gitignored
   `test-accounts.md` at the repo root.
4. Noticed, not yet acted on: `next build` prints "The 'middleware' file
   convention is deprecated. Please use 'proxy' instead" (Next.js
   16.2.10). Not urgent.
5. Edge Functions (`place-order`/`stripe-webhook`/`vnpay-ipn`/
   `vnpay-return`) are still comment-only stubs — the Orders sub-project
   should account for `place-order` at least, since real order placement
   needs atomic stock decrement + payment handling.
