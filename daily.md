# Today: Customer ordering flow built

## Task

Ported the customer ordering flow (Menu → Cart → Checkout → Order Tracking)
from the approved Stitch designs into real, interactive Next.js pages —
not placeholders. Built a real client-side cart (React Context +
localStorage) and mock menu data since Supabase doesn't exist yet.

## Context

- Full details: `continuity.md` ("Customer ordering flow" section), `CLAUDE.md`
  (same section name)
- Design source: `design/stitch-exports/02-menu.html` through `05-order-tracking.html`
- New files: `hooks/useCart.tsx`, `lib/mock-data/menu.ts`,
  `components/customer/{header,bottom-nav,menu-browser,cart-view,checkout-view,order-tracking}.tsx`

## Done when

- `npm run build` succeeds, still 20 routes — done
- All 4 pages return 200 with correct bilingual content on both `/vi/*` and
  `/en/*` — done, verified with curl
- Add-to-cart → view cart → checkout → place order → order tracking is a
  complete, navigable flow (cart persists via localStorage, "Place Order"
  clears it and redirects to a mock order tracking page) — done by code
  review + successful build; not click-tested in a real browser (no
  browser automation tool available in this environment)
- Next session starts on: staff pages (POS, Kitchen Display), then admin
  pages, using this session's pattern (mock data, real interactivity,
  both message files updated together, Base UI's `render` prop not `asChild`)
