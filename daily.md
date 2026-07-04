# Today: All admin pages built — FE priority list complete

## Task

Ported all six admin pages (Dashboard, Menu, Inventory, Tables, Staff,
Settings) from the approved Stitch designs into real, interactive Next.js
pages. Replaced the plain top-nav admin layout with a proper left sidebar
shared by all admin routes (including the pre-existing Food Cost
Calculator). This completes the FE priority order agreed earlier
(theme → customer → staff → admin) — every page in the app is now real UI,
none are translated-placeholder headings anymore.

## Context

- Full details: `continuity.md` ("Admin pages" section), `CLAUDE.md` (same
  section name)
- Design source: `design/stitch-exports/12-admin-dashboard.html` through
  `17-admin-settings.html`
- New files: `components/admin/{admin-sidebar,dashboard-view,menu-management,
  inventory-management,tables-management,staff-accounts,settings-view}.tsx`

## Done when

- `npm run build` succeeds, still 20 routes — done
- Anonymous visitors still redirect from every `/admin/*` route (including
  the pre-existing Food Cost Calculator, unaffected by the sidebar layout
  change) to `/login` — done, verified with curl, no regression
- Every "not implemented yet" action (Add Item/Table/Staff, Download QR)
  is visibly disabled with an explanatory tooltip, not silently dead or faked
- Actions with no real persistence need still work locally where reasonable
  (availability toggle, restock, QR token regen, staff activate/deactivate,
  settings save) — done by code review + successful build; not click-tested
  against a real authenticated session (no live Supabase, no browser
  automation tool available in this environment — same caveat as every
  other page built this session)
- Next session starts on: backend (Supabase DB schema/RLS/Edge Functions
  per the implementation plan), then replacing every mock data source
  listed in continuity.md with real queries
