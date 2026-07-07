# Next up: camera-based QR scanning on Landing (first of three queued features)

## Status

Payments follow-up (Cash/Stripe/VNPay) is complete — see CLAUDE.md's
"Stripe payment integration"/"VNPay payment integration" sections.

A batch of user-reported bugs and small feature requests (2026-07-08)
has been triaged and the quick ones are done:
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

Three remaining items from that same batch are real features, not quick
fixes — user asked to tackle them **first come, first serve**, in the
order originally reported:

## Open / not started

1. **Landing's "Scan QR at Table" button** — currently disabled, no
   camera-based QR scanning exists at all. Needs real design
   (permissions, decode library, no-camera fallback) before building —
   next up.
2. **Table status visibility in Kitchen Display + Admin Dashboard,
   auto-tied to order completion** — table occupancy (`tables.is_occupied`)
   is currently a manual admin-only toggle, not connected to orders at
   all. User wants an order finishing to free up its table automatically,
   plus a real "table status" surface in both KDS and the Admin Dashboard.
3. **Admin Dashboard using real, live data** — revenue/orders/loyalty
   KPIs and the 7-day chart are still fixed mock numbers (documented,
   not hidden, in CLAUDE.md). Needs real aggregation queries + Realtime.

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
