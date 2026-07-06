# Next up: Stripe/VNPay follow-up (or user's call)

## Status

All four "make all data real-time" sub-projects (Inventory, Tables,
Orders core Cash-only, Staff accounts) are shipped and live on Vercel.
Full structural detail lives in CLAUDE.md — this file only tracks what's
still open.

## Open / not started

1. **Ask the user what's next** — don't assume:
   - Stripe follow-up spec — real Stripe Checkout/PaymentIntent + webhook,
     wrapping the already-built `place_order` RPC. Checkout's Card button
     is currently disabled+tooltip.
   - VNPay follow-up spec — would come after Stripe, per the sequencing
     agreed when Orders started. Checkout's VNPay button is currently
     disabled+tooltip.
   - Something else entirely — the "make all data real-time" initiative
     that's been running is now fully complete.

## Known gaps (documented, not hidden — pick up whenever that area is next touched)

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
