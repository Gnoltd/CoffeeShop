# Open / not started

1. **Live-verify the Admin Dashboard by hand** — KPIs are real
   (`get_dashboard_stats()`, migration `0026`), but a full manual
   walkthrough hasn't been confirmed: real KPI numbers (cross-check
   Orders Today against Staff Order History), the 7-day chart's
   bars/weekday labels, Best Sellers reflecting real orders, a
   Realtime update after placing a new paid order, and the Excel
   export (all 5 sheets, correct Vietnamese text, real numeric cells
   for revenue/quantity columns — not text). Two automated attempts at
   this check (cloud routine, 2026-07-10/11) both stalled without
   landing a result — try a manual pass instead of another automated
   retry.
2. **Shift closing feature — live verification not confirmed done.**
   Code for Tasks 1-4 is committed and pushed (`shifts` table +
   `orders.paid_at` + RPCs, query layer, i18n, `/admin/shift` page +
   nav entries), but Task 5 (live-verify the open/report/close flow +
   this file's entry) has no recorded evidence of having run. Same two
   stalled automated attempts as item 1 above. Plan:
   `docs/superpowers/plans/2026-07-10-shift-closing.md`.
3. **Reward redemption checkout round trip not fully tested end-to-end.**
   Redemption is now spendable at checkout (migration `0040`,
   2026-07-11: flat `discount_value_vnd` per reward, multiple per order,
   dynamic 1-year expiry that resets on >1,000,000 VND spend since
   redemption) — code builds/deploys clean and each surface renders
   correctly in isolation (redeem → code shown; `/loyalty/redemptions`
   status list; checkout's "My Rewards" toggle list; `/staff/rewards`
   lookup). Never verified with one real redemption all the way
   through: redeem → select it at checkout → place the order → confirm
   the total actually discounted → confirm `/loyalty/redemptions` shows
   it "Used" → confirm `/staff/rewards` also shows "Used at checkout"
   (not double-honorable). Blocked on the test customer account not
   having enough loyalty points to redeem anything (28 pts, cheapest
   reward is 50) — earn more via a real paid order, or ask to top up
   the test account intentionally (wasn't done automatically; that's
   fabricating production loyalty data without being asked).
4. **Staff redemption lookup round trip not fully tested end-to-end**
   (same underlying blocker as item 3) — search/fulfill only tested
   with a non-matching code so far.
5. **Forgot password — real-email round trip unconfirmed.** Shipped and
   live-verified end-to-end except for the actual emailed link: request
   flow (email entry → "check your email" screen, works regardless of
   whether the address is registered), navigation between views, and
   `/reset-password`'s expired-link handling with no valid session all
   confirmed live. Clicking a real reset email, setting a new password,
   and confirming login with it afterward hasn't been confirmed — same
   documented shared-email-sender rate-limit risk as signup confirmation
   and Google-linking. Plan: `docs/superpowers/plans/2026-07-11-forgot-password.md`.

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

Two throwaway test accounts (staff/customer roles, credentials in
`.env.local` and the gitignored `test-accounts.md`) are kept
deliberately for the user's ongoing manual testing — not a cleanup gap,
don't remove or flag these.
