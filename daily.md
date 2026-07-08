# Next up: live-verify deferred payment on Vercel, then Admin Dashboard real data

## Status

**Deferred payment + table-driven service lifecycle is fully built and
pushed to `main`** (spec:
`docs/superpowers/specs/2026-07-08-deferred-payment-service-lifecycle-design.md`,
plan: `docs/superpowers/plans/2026-07-08-deferred-payment-service-lifecycle.md`,
14/14 tasks done). Migration `0022` applied live; all 4 affected Edge
Functions (`place-order`, new `pay-order`, `stripe-webhook`,
`vnpay-ipn`, `vnpay-return`) deployed live. Typecheck, all 67 Vitest
tests, and `npm run build` all pass locally.

**Not yet done: the live walkthrough on Vercel.** This session had no
browser automation available, so the actual click-through verification
(place a Pay Later order, watch it hit KDS immediately, tap "Served" on
the table card, confirm Awaiting Payment + Confirm Cash Received /
customer-side Pay Now button, confirm auto-completion + table moves to
Cleaning, check the failure-retry path doesn't cancel a served order)
has not been run. Do this next — full checklist is in Task 14 of the
plan file above.

Also still pending from the previous feature: **table status (shipped
2026-07-08, in CLAUDE.md) has never been live-verified on Vercel
either** — worth doing both walkthroughs in the same pass, since the
deferred-payment feature builds directly on top of table status (same
`sync_table_occupancy` trigger, same KDS Tables column).

## Open / not started

1. **Admin Dashboard using real, live data** — revenue/orders/loyalty
   KPIs and the 7-day chart are still fixed mock numbers (documented,
   not hidden, in CLAUDE.md). Needs real aggregation queries + Realtime.
   The Table Status card already on that dashboard is separate and
   already real — this item is only about the remaining mock KPIs/chart.

## Known gaps (documented, not hidden — pick up whenever that area is next touched)

- `VNPAY_RETURN_URL` (synced to Vercel) is dead — VNPay's actual return
  URL is built dynamically in `place-order` pointing at the Supabase
  function URL instead. Worth removing the unused Vercel var, or
  documenting why it's kept, next time env vars are audited.
- `checkout-view.tsx`'s `orderType` state only reads `activeTable` once
  at first render — can default to "pickup" even when `activeTable`
  becomes populated moments later after a full reload (before
  `TablesProvider`'s `localStorage` hydration effect runs). Fix options:
  re-derive `orderType` reactively, or gate Checkout's initial render on
  hydration finishing.
- `next build` still prints the "middleware deprecated, use proxy"
  warning (Next.js 16.2.10). Renaming `middleware.ts` → `proxy.ts` also
  touches `lib/middleware-rules.ts`, which it depends on. Not urgent.
- No Vitest/RTL coverage beyond the `lib/supabase/*.ts` query layers and
  `lib/middleware-rules.ts`/`lib/get-current-role.ts` — component-level
  tests were never added (skipped so far, not a regression).
- POS (`components/staff/pos-terminal.tsx`) was not touched by the
  deferred-payment work — it still always collects payment in person
  (`paymentCollected: true`), so Pay Later is a self-checkout-only
  concept for now. That's intentional (POS staff are standing right
  there, no reason to defer), not an oversight, but worth stating
  explicitly since it's not written down anywhere else yet.

Two throwaway test accounts (staff/customer roles, credentials in
`.env.local` and the gitignored `test-accounts.md`) are kept
deliberately for the user's ongoing manual testing — not a cleanup gap,
don't remove or flag these.
