# Next up: user's call — payments follow-up is complete

## Status

All three payment methods are now real and verified live: Cash, Stripe
(`docs/superpowers/specs/2026-07-07-stripe-payment-integration-design.md`,
`docs/superpowers/plans/2026-07-07-stripe-payment-integration.md`), and
VNPay (`docs/superpowers/specs/2026-07-07-vnpay-payment-integration-design.md`,
`docs/superpowers/plans/2026-07-07-vnpay-payment-integration.md`). This
closes out the entire payments follow-up agreed when the Orders Realtime
work shipped (Cash → Stripe → VNPay) — no payment-related backend work
remains deferred. Full structural detail is in CLAUDE.md's "Stripe
payment integration" and "VNPay payment integration" sections; this file
only tracks what's still open.

Two real bugs were found and fixed during this work, both via live
sandbox testing rather than guessing:
- A pre-existing dine-in `order_type` enum mismatch (Checkout/POS sent
  hyphenated `"dine-in"`, the DB enum wants `dine_in`) that silently
  broke every dine-in order regardless of payment method.
- A VNPay signature encoding bug — VNPay signs with PHP
  `urlencode()`-style encoding (`+` for spaces), not plain
  `encodeURIComponent`'s `%20`. Root-caused by comparing against a known
  working reference implementation, not by guessing.

## Open / not started

1. **Ask the user what's next** — the payments initiative that's been
   running since Orders Realtime is now fully complete. No specific
   next task is queued.

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
- Two throwaway test accounts (staff/customer roles) exist in the live
  Supabase project — credentials in `.env.local` and the gitignored
  `test-accounts.md` at the repo root. Clean up once no longer needed
  for manual testing.
- No Vitest/RTL coverage beyond the `lib/supabase/*.ts` query layers and
  `lib/middleware-rules.ts`/`lib/get-current-role.ts` — component-level
  tests were never added (skipped so far, not a regression).
