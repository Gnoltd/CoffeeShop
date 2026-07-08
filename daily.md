# Next up: finish live verification of deferred payment + table status

## Status

Today's live testing surfaced and fixed 5 real bugs in the
deferred-payment + table-status features, all deployed to `main`:
1. `sync_table_occupancy` trigger was scoped to `update of status`,
   missing completions that happen via `payment_status`-only updates
   (migration `0024`).
2. Checkout's fake `FALLBACK_TABLE_NUMBER` let Dine-in orders through
   with no real table — removed; Dine-in now requires a real scan.
3. `tables` had no RLS UPDATE policy for `staff` role — KDS's Cleaning
   Done silently did nothing for staff accounts (migration `0025`).
4. KDS Tables column had no button at all for a table whose order had
   already left the active list — the status badge itself is now a
   tap-to-cycle manual override, matching Admin Tables.
5. The tracking page's Cash confirmation waited on Realtime before
   showing anything — now shows immediately via local state.

**All cleanup confirmed done**: Table 2 and Table 4 are both back to
`available`. The orphaned test order (`c5b531cf...`, created before the
Checkout fix, no `table_id`) has been cancelled directly in the DB —
it was test data with no real table to route any action through.
Nothing left over from today's debugging.

## Open / not started

1. **Finish live verification of the deferred-payment feature** — the
   original scenario that exposed bug #1 (dine-in, Pay Later, choose
   Stripe/VNPay once served, confirm the table auto-moves to Cleaning)
   should be re-run now that it's fixed, plus the rest of the original
   checklist: Cash Pay Later, pickup, the failure-retry path.
2. **Live-verify table status** (shipped 2026-07-08, documented in
   CLAUDE.md) — still never walked through end-to-end on Vercel.
3. **Admin Dashboard using real, live data** — revenue/orders/loyalty
   KPIs and the 7-day chart are still fixed mock numbers (documented,
   not hidden, in CLAUDE.md). The Table Status card on that dashboard
   is separate and already real — this item is only the remaining mock
   KPIs/chart.

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
