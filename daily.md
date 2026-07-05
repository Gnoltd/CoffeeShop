# Today: Full admin/staff/manager audit against Stitch, built out real functions

## Task

User asked to check every remaining admin page (Dashboard, Inventory,
Tables, Staff, Settings) against its Stitch mockup and fully build the
missing functionality now, using real interactions over mock data, saving
only backend wiring for later. Found and fixed real gaps in all 5 pages.

## Context

- Full details: `continuity.md` ("Full admin/staff/manager audit against
  Stitch" section), `CLAUDE.md` (under "Admin pages")
- New: `hooks/useInventory.tsx`, `components/admin/staff-member-form.tsx`
- Changed: `dashboard-view.tsx`, `inventory-management.tsx`,
  `tables-management.tsx`, `staff-accounts.tsx`, `settings-view.tsx`,
  `hooks/useTables.tsx` (new `isOccupied`/`scanCount`/location fields),
  `app/[locale]/admin/layout.tsx` (mounts `InventoryProvider`)

## Done when

- `npm run build` succeeds, no type errors — done, clean on first try
- curl confirms real content on all 5 pages in both locales — done
- `/admin/*` auth gate unaffected — done
- Dashboard and Inventory share one real ingredient/restock-log source
  instead of two disconnected mock copies — done
- Tables' scan counter and occupancy are genuinely derived from real
  interactions (QR visits, admin toggles), not hardcoded — done
- Staff Add/Edit is real (same pattern as Menu's), with pagination and
  real stat cards — done
- Settings has a real Loyalty on/off toggle and a working Cancel that
  reverts unsaved edits — done
- Deliberately did NOT fake trend percentages, member counts, or "new
  hire" numbers with no real signal behind them — documented as an
  intentional gap, not an oversight
- Not click-tested in a real browser (toggles, tab switches, pagination
  clicks, restock cross-page sync) — no browser automation tool available
  in this environment, standing caveat for the whole project

## Next session

Every admin/staff/customer page has now been checked against its Stitch
mockup and brought to real, interactive parity (mock data, no fake
analytics). Backend is next — Supabase DB schema/RLS/Edge Functions per
the implementation plan, then replace every mock/shared-hook data source
with real queries (+ Realtime where noted).
