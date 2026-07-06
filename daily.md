# Next up: VNPay follow-up (or user's call)

## Status

Stripe payment integration is shipped and verified live: real Stripe
Checkout Sessions from customer self-checkout, webhook-confirmed
payment (`checkout.session.completed`/`checkout.session.expired`),
self-cancel via a guest-safe `cancel_pending_order` RPC, and POS's Card
option (marks paid immediately, no Stripe API call — money already
collected via a physical terminal). Design:
`docs/superpowers/specs/2026-07-07-stripe-payment-integration-design.md`.
Plan: `docs/superpowers/plans/2026-07-07-stripe-payment-integration.md`.
Full structural detail belongs in CLAUDE.md once that's updated — this
file only tracks what's still open.

A real pre-existing bug was found and fixed as part of this work:
Checkout and POS both sent the hyphenated `"dine-in"` string straight to
`place_order`, which casts it to the `order_type` enum (`pickup|dine_in`,
underscore) — every dine-in order was silently failing before this fix,
regardless of payment method.

A real webhook misconfiguration was found and fixed during live
verification: the Stripe webhook endpoint was initially pointed at the
Vercel frontend URL instead of the Supabase Edge Function URL, and then
`STRIPE_WEBHOOK_SECRET` was initially missing from Supabase's Edge
Function secrets (a separate store from Vercel's env vars — syncing a
var to Vercel does not make it available to `Deno.env` in an Edge
Function). Both fixed; verified live end-to-end afterward (real Stripe
test payment → webhook → order flipped to paid → loyalty points
awarded correctly).

## Open / not started

1. **Ask the user what's next:**
   - VNPay follow-up spec — the last remaining payment method, per the
     sequencing agreed when Orders started (Cash → Stripe → VNPay).
     Checkout's VNPay button is currently disabled+tooltip.
   - Something else entirely.

## Known gaps (documented, not hidden — pick up whenever that area is next touched)

- `checkout.session.expired` (the 30-minute auto-cancel-abandoned-order
  path) was verified architecturally (identical guarded `UPDATE` to the
  already-proven `checkout.session.completed` path) but not triggered
  directly during this session's live testing — worth a real Stripe
  "resend test event" check next time this area is touched.
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
