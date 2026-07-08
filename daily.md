# Next up: live-verify the Admin Dashboard real data + Excel export

## Status

Deferred payment + table-driven service lifecycle and table status are
both shipped, live-verified, and working — see CLAUDE.md for the
structural summary of both features. A handful of real bugs found
during live testing (trigger column-scope gap, a fake-table checkout
fallback, an RLS gap blocking staff writes to `tables`, a missing KDS
manual override, a Realtime UX lag) were all found and fixed the same
day; no follow-up needed.

Spotlight hero landing redesign (2026-07-09) is shipped and
live-verified: full-screen dark hero with cursor/touch-following
spotlight reveal (CSS gradient mask, no canvas), Playfair Display italic
display accent, adapted nav, Order Now + Scan QR CTAs, both locales,
promo/best-sellers/categories intact below. `CustomerHeader` was removed
from the marketing layout only (the hero's `LandingNav` is that page's
header); `BottomNav` stays. Spec/plan:
`docs/superpowers/{specs,plans}/2026-07-08-spotlight-hero-landing*.md`.

Admin Dashboard real data + Excel export is implemented, typechecked,
built, unit-tested (71/71 passing), and pushed/deployed to
`https://phadincoffee.vercel.app` — `get_dashboard_stats()` RPC
(migration `0026`) backs real revenue/orders/loyalty KPIs, a 7-day
chart, and best sellers, all Realtime on `orders`/`order_items`/
`loyalty_transactions`. A 5-sheet `.xlsx` export button (`xlsx`/
SheetJS) was added alongside it. Not yet walked through by hand on the
live site — see Open below.

## Open / not started

1. **Live-verify the Admin Dashboard** — confirm real KPI numbers
   (cross-check Orders Today against Staff Order History), the 7-day
   chart's bars/weekday labels, Best Sellers reflecting real orders,
   a Realtime update after placing a new paid order, and the Excel
   export (all 5 sheets, correct Vietnamese text, real numeric cells
   for revenue/quantity columns — not text).

## Known gaps (documented, not hidden — pick up whenever that area is next touched)

- `VNPAY_RETURN_URL` (synced to Vercel) is dead — VNPay's actual return
  URL is built dynamically in `place-order` pointing at the Supabase
  function URL instead. Worth removing the unused Vercel var, or
  documenting why it's kept, next time env vars are audited.
- `next build` still prints the "middleware deprecated, use proxy"
  warning (Next.js 16.2.10). Renaming `middleware.ts` → `proxy.ts` also
  touches `lib/middleware-rules.ts`, which it depends on. Not urgent.
- No Vitest/RTL coverage beyond the `lib/supabase/*.ts` query layers and
  `lib/middleware-rules.ts`/`lib/get-current-role.ts` — component-level
  tests were never added (skipped so far, not a regression).
- POS (`components/staff/pos-terminal.tsx`) always collects payment in
  person (`paymentCollected: true`) — Pay Later is a self-checkout-only
  concept, deliberately (POS staff are standing right there).
- A **pickup** Pay Later order sitting at `served`/unpaid/no-method-
  chosen has no staff-side "Mark Cash" surface (unlike dine-in's table
  card) — only the customer's own tracking page can choose a method for
  it. Pickup has no table to attach that control to.

Two throwaway test accounts (staff/customer roles, credentials in
`.env.local` and the gitignored `test-accounts.md`) are kept
deliberately for the user's ongoing manual testing — not a cleanup gap,
don't remove or flag these.
