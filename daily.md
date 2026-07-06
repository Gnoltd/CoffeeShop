# Today: Menu item extras/modifiers shipped; starting the "all data real-time" project

## Task

Previous session finished the menu item extras/modifiers feature
(brainstormed, spec'd, planned, implemented, verified live, and merged —
see "Done last session" below). Today's task, per the user's own
sequencing from last time ("both 1 first second later" — extras first,
real-time second): **start the "make all data real-time" project.** This
is the large remaining backend item `CLAUDE.md`'s "Building the rest"
section already flags — converting inventory/orders/tables/staff from
local mock/Context state to real Supabase-backed data, with Realtime
subscriptions where it matters (Kitchen Display, Order Tracking, Order
History).

## Done last session (for context, not re-doing)

### Menu item extras/modifiers (shipped)

Admin-configurable optional extras (e.g. "Extra Shot +10.000đ") — each
extra is its own single-option `modifier_group`, reused across items via
the existing `menu_item_modifier_groups` join table (no schema change).

- Spec: `docs/superpowers/specs/2026-07-06-menu-item-extras-design.md`.
  Plan: `docs/superpowers/plans/2026-07-06-menu-item-extras.md` (5 tasks,
  executed inline on `main`).
- `lib/supabase/menu-data.ts` gained `getModifierGroups`/
  `createModifierGroup`/`setItemModifierGroups`.
- `components/admin/menu-item-form.tsx` gained an "Extras" section:
  checklist of existing extras + inline "+ Add New Extra" form; selecting
  an item for edit shows its currently-attached extras (checked).
- `components/admin/menu-management.tsx`'s `saveItem` now also calls
  `setItemModifierGroups` after create/update, then refetches the item so
  the form/table/grid all reflect the saved extras.
- **Real bug fixed along the way**: an optional (non-required)
  single-option modifier group — exactly what an extra is — could be
  selected on the Product Detail Page but never deselected. Fixed in
  `components/customer/product-detail.tsx`'s click handler to actually
  toggle off for non-required groups; required groups (Size) unaffected.
- Verified live on Vercel via Playwright end-to-end: admin creates an
  extra → it auto-attaches to the item being edited → a different item
  shows it unchecked → re-opening the first item after editing a second
  confirms the refetch-after-save works → on the customer Product Detail
  Page selecting the extra raises the price and deselecting reverts it →
  added to cart, "Extra Shot" shows as a real cart line item.
- All 5 commits (`2a7658a`..`ba87804`) pushed to `main`, deployed, 19/19
  tests passing. `finishing-a-development-branch` confirmed nothing to
  merge/PR — normal repo, already on `main`, everything pushed.

## Today's plan: real-time data project

This is flagged as large — per last session's own note, it should be
**decomposed into sub-projects** (each its own brainstorm → spec → plan →
implementation cycle) rather than designed as one giant feature. Proposed
order (to confirm with the user at brainstorm start), roughly by how many
other pages already depend on each data source:

1. **Inventory** — `hooks/useInventory.tsx` (ingredients + logs) is
   already the shared source for Dashboard + Inventory; migrating it to
   real Supabase tables (`ingredients`, `inventory_logs` — schema per
   `docs/superpowers/plans/2026-07-04-coffee-shop-scaffold.md` Task 6) is
   the most contained first slice, and Dashboard's low-stock widget
   already depends on it.
2. **Tables** — `hooks/useTables.tsx` (table list, QR tokens, active
   session, occupied/scan-count) → a real `tables` table + RLS. Unlocks
   real QR-token persistence (currently a client-only mock token) and
   removes the documented gap where regenerating a token doesn't
   invalidate an in-progress session.
3. **Orders** — the biggest slice: `hooks/useOrders.tsx` (customer
   Checkout/Tracking/History) and `hooks/useKitchenOrders.tsx` (POS/KDS)
   are currently two separate mock systems that don't talk to each other
   (a customer's Checkout order never reaches the Kitchen Display board).
   A real `orders`/`order_items` schema + Realtime subscriptions is also
   the point where these two systems should finally unify — needs its own
   design discussion (single `orders` table drives both customer tracking
   and staff KDS).
4. **Staff accounts** — `components/admin/staff-accounts.tsx`'s local
   mock array → real `profiles` queries (role management, activate/
   deactivate) with proper RLS (admin-only write, matching the existing
   `on_profile_role_change` trigger).

Edge Functions (`place-order`, `stripe-webhook`, `vnpay-ipn`,
`vnpay-return` — still comment-only stubs) are closely related to the
Orders slice (#3) — real order placement needs atomic stock decrement +
payment handling — so that slice's design should account for them even
if payment integration itself stays out of scope for now.

## Next session starts here

1. **Kick off the real-time data brainstorm.** Start by proposing the
   sub-project decomposition above to the user for confirmation/
   adjustment, then brainstorm just the first sub-project (Inventory,
   tentatively) through the normal design → spec → plan → implementation
   cycle. Don't design all four slices at once.
2. Two throwaway test accounts (staff/customer roles) exist in the live
   Supabase project for role-based testing — credentials in `.env.local`
   (`TEST_STAFF_EMAIL`/`TEST_STAFF_PASSWORD`, `TEST_CUSTOMER_EMAIL`/
   `TEST_CUSTOMER_PASSWORD`) and the gitignored `test-accounts.md` at the
   repo root. Reuse them rather than recreating via SQL.
3. Noticed, not yet acted on: `next build` prints "The 'middleware' file
   convention is deprecated. Please use 'proxy' instead" (Next.js
   16.2.10). Not urgent — `middleware.ts` (and the `lib/middleware-rules.ts`
   it depends on) would need renaming/restructuring per Next's new
   convention whenever this gets picked up.
4. Edge Functions (`place-order`/`stripe-webhook`/`vnpay-ipn`/
   `vnpay-return`) are still comment-only stubs — see "Today's plan"
   above for why the Orders sub-project should account for them.
