# Open / not started

1. **"Neubrutalist Modern" full-app redesign — Phase 1 shipped to `main`,
   live verification not yet done.**
   Design spec: `docs/superpowers/specs/2026-07-12-elevated-warm-redesign-design.md`
   (title says "Elevated Warm" but the actual locked style is
   Neubrutalist Modern — see the spec's revision note). Covers every
   page: Landing, Menu, Cart/Checkout, Orders, Profile/Loyalty, POS,
   KDS, and all 8 Admin views (Dashboard + Menu Mgmt/Inventory/Tables/
   Food Cost/Shift/Staff/Settings). Validated via 8 full interactive
   HTML mockups (Artifacts, ephemeral to that conversation — not in the
   repo) with live pixel-level iteration, not static wireframes.
   **Phase 1** (`docs/superpowers/plans/2026-07-12-neubrutalist-redesign-phase1-foundation-landing-menu.md`)
   is code-complete and pushed (`934e72c`): design tokens + working dark
   mode (`hooks/useTheme.tsx`, `ThemeToggle`, no-flash init script —
   `globals.css` already had a dormant `.dark` class from the shadcn
   scaffold, never wired to a toggle until now), an additive `neubrutal`
   variant on shared `Button`/`Badge`, and Landing + Menu re-skinned
   (including fixing the quick-add button's touch target from 32px to a
   real 44px hit area). `tsc --noEmit` and the full test suite (140
   tests) passed after every task. **Not yet confirmed**: the live
   Vercel deploy hasn't been eye-verified (colors/dark-mode/mobile —
   deliberately deferred by explicit user request, to be done later).
   Phase 2 (Cart/Checkout, Orders, Profile/Loyalty) is next per the
   spec's rollout order; Phase 3 (POS/KDS) and Phase 4 (Admin) follow.
   Real requirements surfaced during design that implementation must
   not skip on later phases: an explicit `color` on every `<button>`
   (found black-text-in-dark-mode bugs from browser button-color
   non-inheritance — already fixed once on Menu's category pills during
   mockup review, watch for the same class of bug elsewhere), 44×44pt
   touch targets on customer-facing controls via hit-slop (not visual
   resize), a POS/KDS/Admin app-switcher in the staff top bar (new, not
   previously specced), and Shift's report gaining a real Cash/Card/
   VNPay breakdown (UI-only — `get_shift_report()` already returns this
   data per CLAUDE.md, just needs wiring into the current + history
   views).

2. **Live-verify the Admin Dashboard by hand** — KPIs are real
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
3. **Shift closing feature — live verification not confirmed done.**
   Code for Tasks 1-4 is committed and pushed (`shifts` table +
   `orders.paid_at` + RPCs, query layer, i18n, `/admin/shift` page +
   nav entries), but Task 5 (live-verify the open/report/close flow +
   this file's entry) has no recorded evidence of having run. Same two
   stalled automated attempts as item 1 above. Plan:
   `docs/superpowers/plans/2026-07-10-shift-closing.md`.
4. **Set the real tax rate.** Admin Settings now genuinely persists
   (migration `0042`, 2026-07-11) and POS/checkout both apply
   `shop_settings.tax_rate` for real — but it's deliberately left at
   `0` since no real rate was ever specified (previously a hardcoded,
   never-actually-charged `8%` in POS only). Set the real rate via
   `/admin/settings` whenever convenient — also a good moment to fill
   in shop name/address/phone/hours, which were never persisted either.
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
