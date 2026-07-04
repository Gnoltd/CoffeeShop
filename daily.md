# Today: Staff pages built (POS, Kitchen Display)

## Task

Ported the two staff pages (POS terminal, Kitchen Display) from the
approved Stitch designs into real, interactive Next.js pages, simplifying
the mockups' sidebar chrome (staff photo, shift stats) since it needs real
auth data that doesn't exist yet. Both reuse the customer flow's mock menu
data and patterns (real interactivity, both message files, Base UI's
`render` prop not `asChild`).

## Context

- Full details: `continuity.md` ("Staff pages" section), `CLAUDE.md` (same
  section name)
- Design source: `design/stitch-exports/10-staff-pos.html`,
  `11-staff-kitchen-display.html`
- New files: `components/staff/{staff-nav,pos-terminal,kitchen-display}.tsx`

## Done when

- `npm run build` succeeds, still 20 routes — done
- Anonymous visitors still redirect from `/staff/pos` and `/staff/orders` to
  `/login` (regression check that these changes didn't weaken the auth gate)
  — done, verified with curl
- POS: category filter, item grid, order-building sidebar with quantity
  steppers, order type/payment selection, tax calc, charge button — done by
  code review + successful build; not click-tested against a real
  authenticated session (no live Supabase, no browser automation tool)
- Kitchen Display: 3-column board with real ticking timers and working
  status-advance buttons — same verification caveat as POS
- Next session starts on: admin pages (Dashboard, Menu, Inventory, Tables,
  Staff, Settings) — the last set of pages in the agreed FE priority order
