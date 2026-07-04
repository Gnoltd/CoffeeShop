# Today: Table identity flow wired end-to-end (rename → QR → checkout → order tracking)

## Task

Answered and implemented the user's question: renaming a table in Admin
Tables now flows all the way through to what a customer sees after
scanning that table's QR code. Visualized the two new screens in Stitch
first (Table QR Landing, Admin Tables rename state), got approval, then
built the real connected implementation.

## Context

- Full details: `continuity.md` ("Table identity flow" section), `CLAUDE.md`
  (same section name)
- New: `hooks/useTables.tsx`, `components/customer/table-landing.tsx`
- Rewritten: `components/admin/tables-management.tsx`,
  `app/[locale]/(customer)/table/[qrToken]/page.tsx`
- Updated: `components/customer/checkout-view.tsx`,
  `components/customer/order-tracking.tsx`,
  `app/[locale]/(customer)/orders/[orderId]/page.tsx`,
  `app/[locale]/layout.tsx` (mounts `TablesProvider`),
  `messages/vi.json` + `messages/en.json`

## Done when

- `npm run build` succeeds, still 20 routes — done
- `/vi/table/table-1` and `/en/table/table-2` render the real landing page;
  an unknown token shows the "Invalid Table Code" state — done, verified
  with curl (SSR shell only — the resolve step is client-side)
- Checkout forwards the real table number to Order Tracking via `?table=`,
  and Order Tracking displays it — done, verified with curl
  (`?table=7` → "Bàn số 7"; no param → mock fallback "Bàn số 04")
- Anonymous visitors still redirect from `/admin/*` to `/login` (regression
  check, unaffected by this feature) — done, verified with curl
- Admin Tables rename is real (local/localStorage state via `useTables()`),
  not click-tested in a real browser — no browser automation tool available
  in this environment, same caveat as every other page built this session
- Next session starts on: backend (Supabase DB schema/RLS/Edge Functions
  per the implementation plan), then replacing every mock data source
  listed in continuity.md with real queries — the table flow's
  `localStorage`-backed hook becomes a real `tables` table + Realtime then
