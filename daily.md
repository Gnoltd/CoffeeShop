# Open / not started

1. **Live-verify the Admin Dashboard by hand** — KPIs are real
   (`get_dashboard_stats()`, migration `0026`), but a full manual
   walkthrough hasn't been confirmed: real KPI numbers (cross-check
   Orders Today against Staff Order History), the 7-day chart's
   bars/weekday labels, Best Sellers reflecting real orders, a
   Realtime update after placing a new paid order, and the Excel
   export (all 5 sheets, correct Vietnamese text, real numeric cells
   for revenue/quantity columns — not text).
2. **Google sign-in — code wired and deployed, full round-trip not yet
   confirmed by a real login.** Google Cloud OAuth client + Supabase
   Auth provider are configured (user-side, done); both buttons call
   `signInWithOAuth`, and a callback route resolves role via the
   existing `getCurrentRole` and redirects to `ROLE_HOME[role]` (plan:
   `docs/superpowers/plans/2026-07-11-google-oauth-signin.md`). **Real
   404 bug found and fixed same day**: the callback page lives under
   `app/[locale]/(auth)/callback/page.tsx` — `(auth)` is a route group
   (parentheses), which never contributes a URL segment, exactly like
   `login`/`signup` already resolve to bare `/login`/`/signup` with no
   `/auth/` prefix. The page therefore only ever existed at
   `/<locale>/callback`, but `redirectTo` was constructed as
   `/<locale>/auth/callback` — a URL that never existed. Confirmed live
   (`/vi/auth/callback` 404s, `/vi/callback` 200s) before fixing both
   forms' `redirectTo` to the real path; no Supabase Dashboard change
   needed (redirect URL allowlist is a domain-wide wildcard). Live-
   verified after the fix: both buttons redirect to Google's real
   consent screen with the correct `client_id` and the corrected
   `redirect_to=.../vi/callback`. **Still not verified**: an actual
   completed Google login round-trip (can't be scripted — needs a real
   Google account signing in by hand) — confirm it lands on the right
   `ROLE_HOME` destination, a brand-new Google account gets a real
   `profiles` row and lands on `/menu` as `customer`, and cancelling
   the consent screen shows the callback page's timeout error instead
   of hanging.
3. **Shift closing feature — live verification not confirmed done.**
   Code for Tasks 1-4 is committed and pushed (`shifts` table +
   `orders.paid_at` + RPCs, query layer, i18n, `/admin/shift` page +
   nav entries), but Task 5 (live-verify the open/report/close flow +
   this file's entry) has no recorded evidence of having run. Plan:
   `docs/superpowers/plans/2026-07-10-shift-closing.md`.

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
- A **pickup** Pay Later order sitting at `served`/unpaid has no
  staff-side "Mark Cash"/"Undo" surface (unlike dine-in's table card in
  KDS) — only the customer's own tracking page can choose/change a
  method for it. Pickup has no table to attach that control to.
- Loyalty tier progress has no real tier table — documented mock
  (balance/transaction history are real).
- Rewards catalog/redemption UI is disabled+tooltip — no backing table.

Two throwaway test accounts (staff/customer roles, credentials in
`.env.local` and the gitignored `test-accounts.md`) are kept
deliberately for the user's ongoing manual testing — not a cleanup gap,
don't remove or flag these.
