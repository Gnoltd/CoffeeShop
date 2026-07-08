# Next up: execute the deferred-payment implementation plan

## Status

Spec and plan are done and committed:
- Spec: `docs/superpowers/specs/2026-07-08-deferred-payment-service-lifecycle-design.md`
- Plan (14 tasks, fully coded, no placeholders): `docs/superpowers/plans/2026-07-08-deferred-payment-service-lifecycle.md`

**Nothing from the plan has been built yet.** A cloud routine was tried
first (scheduled Claude Code routine, run_once at 2026-07-07T22:50Z) to
execute it unattended — it fired (`ended_reason: "run_once_fired"`,
confirmed via `RemoteTrigger` `get`), but produced no recoverable
output: the routine's API has no run-transcript/output action, it was
told not to push its branch (`deferred-payment-lifecycle-cloud-run`,
safety measure for an unattended run), and the cloud session isn't
persisted — so `git fetch origin` shows no trace of whatever it did.
That branch name is now a dead end; don't try to look for it.

**Next step**: run the plan for real, inline, in an interactive session
(`superpowers:executing-plans`, task-by-task per the plan file) — that
has Supabase MCP access (`apply_migration`, `deploy_edge_function`),
so unlike the cloud attempt it can actually complete every task,
including the migration (`0022`, adds `served` status + auto-completion
trigger) and the 4 Edge Function deploys (`place-order`, new
`pay-order`, `stripe-webhook` fix, `vnpay-ipn` fix, `vnpay-return` fix).

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
- Table status (shipped 2026-07-08) was pushed straight to `main` and
  passed typecheck/build/tests locally, but has **not yet been verified
  live on Vercel** — this project's actual source of truth for "does it
  work." Worth a real walkthrough (place a dine-in order, complete it,
  confirm Cleaning not Available, tap Cleaning Done, scan a cleaning
  table's QR) next time that area is touched.

Two throwaway test accounts (staff/customer roles, credentials in
`.env.local` and the gitignored `test-accounts.md`) are kept
deliberately for the user's ongoing manual testing — not a cleanup gap,
don't remove or flag these.
