# Next up: execute the deferred-payment plan inline (cloud attempt unretrievable — see below), then verify table status live

## Status

Payments follow-up (Cash/Stripe/VNPay) is complete — see CLAUDE.md's
"Stripe payment integration"/"VNPay payment integration" sections.

A batch of user-reported bugs and small feature requests (2026-07-08)
has been triaged. The quick fixes and the first of three real features
are shipped:
- **Fixed**: Loyalty page was showing a hardcoded `1250` balance and a
  mock transaction array instead of real `profiles.loyalty_points_balance`/
  `loyalty_transactions` — now real (`lib/supabase/loyalty-data.ts`).
- **Fixed**: removed the "PhaDinCoffee — demo build" footer from Profile.
- **Shipped**: Menu's "+" quick-add now always adds directly to cart when
  there's no size decision to make; if the item has extras it opens a
  small extras-only popup (`components/customer/quick-add-extras-popup.tsx`)
  instead of the full Product Detail page. Tapping the item itself still
  opens the full page.
- **Shipped**: admin can now toggle "Has size options" per menu item
  (`menu_items.has_size_options`, migration `0020`) to hide the size
  picker for single-size products regardless of how many size rows exist.
- **Shipped**: Landing's "Scan QR at Table" is now real camera-based
  scanning (`components/customer/qr-scanner-overlay.tsx`, `jsQR`) —
  design: `docs/superpowers/specs/2026-07-08-camera-qr-scanning-design.md`,
  plan: `docs/superpowers/plans/2026-07-08-camera-qr-scanning.md`. User
  confirmed working live on a real phone.
- **Shipped**: table status is a real 3-state lifecycle
  (`tables.status`: `available | occupied | cleaning`, migration `0021`,
  replacing the old `is_occupied` boolean) — spec at
  `docs/superpowers/specs/2026-07-08-table-status-design.md`, plan at
  `docs/superpowers/plans/2026-07-08-table-status.md`. Occupied is
  automatic (DB trigger on dine-in order placement); Cleaning is
  automatic (same trigger, when a table's last active order finishes —
  deliberately not the same event as "guest left"); Available is always
  a manual staff tap ("Cleaning Done"), from the new KDS "Tables" 4th
  board column or Admin Tables. Guests scanning a `cleaning` table's QR
  see a blocked message with a "Notify Staff" button
  (`notify_table_cleaning` guest-safe RPC). Admin Dashboard has a new
  real-time Table Status card. Pushed to `main`
  (`38cc44c..7685467`) — typecheck/build/tests (65) all pass locally;
  **not yet verified live on Vercel** (this project's actual source of
  truth) — do that next.

A fourth, larger feature was brainstormed after that: **deferred payment
+ table-driven service lifecycle** (Pay Now/Pay Later checkout choice,
all 3 methods, both order types; new `served` order status; auto-
completion trigger). Spec:
`docs/superpowers/specs/2026-07-08-deferred-payment-service-lifecycle-design.md`.
Plan (14 tasks, fully coded, no placeholders):
`docs/superpowers/plans/2026-07-08-deferred-payment-service-lifecycle.md`.

**Cloud-routine attempt didn't produce retrievable output.** Tried
delegating inline execution to a scheduled cloud agent (Claude Code
routine, run_once at 2026-07-07T22:50Z, no Supabase MCP access there so
scoped to code-only tasks on branch `deferred-payment-lifecycle-cloud-run`,
told not to push). The routine's `get` status confirms it fired
(`ended_reason: "run_once_fired"`, `last_fired_at: 2026-07-07T22:50:20Z`),
but:
- The `RemoteTrigger` API has no "fetch run transcript/output" action —
  only trigger config is retrievable that way.
- The branch was never pushed (per its own instructions, for safety on
  an unattended run) and the cloud session isn't persisted, so
  `git fetch origin` shows no trace of it.
- **Net result: whatever code it wrote (if any) is not recoverable from
  this environment.** The routine's page on claude.ai may still show the
  session transcript for manual inspection, but that hasn't been checked.

**Next step: just execute the plan directly in an interactive session**
(inline execution, `superpowers:executing-plans`, per the task-by-task
breakdown already in the plan) — this environment has full Supabase MCP
access (`apply_migration`, `deploy_edge_function`), so it can actually
complete every task including the migration and the 4 Edge Function
deploys, not just the code-only subset the cloud routine was limited to.

## Open / not started

1. **Admin Dashboard using real, live data** — revenue/orders/loyalty
   KPIs and the 7-day chart are still fixed mock numbers (documented,
   not hidden, in CLAUDE.md). Needs real aggregation queries + Realtime.
   The new Table Status card (shipped above) is a separate, already-real
   addition to this same dashboard file — this item is only about the
   remaining mock KPIs/chart.

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

Two throwaway test accounts (staff/customer roles, credentials in
`.env.local` and the gitignored `test-accounts.md`) are kept
deliberately for the user's ongoing manual testing — not a cleanup gap,
don't remove or flag these.
