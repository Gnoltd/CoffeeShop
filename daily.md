# Next up: building table status (occupancy + cleaning) — plan approved, executing now

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

Two remaining items from that same batch are real features — user asked
to tackle them **first come, first serve**, in the order originally
reported:

## Open / in progress

1. **Table status (occupancy + cleaning) in KDS + Admin Dashboard +
   guest table-landing page** — design finalized after several rounds
   of clarification, spec at
   `docs/superpowers/specs/2026-07-08-table-status-design.md`, plan at
   `docs/superpowers/plans/2026-07-08-table-status.md`. Final model:
   `tables.status` becomes a 3-state enum (`available | occupied |
   cleaning`), replacing the old `is_occupied` boolean.
   - Occupied: automatic, via a DB trigger when a dine-in order is placed.
   - Cleaning: automatic, via the same trigger when a table's last
     active order finishes (`completed`/`cancelled`) — not the same
     event as "guest left," so it never jumps straight to Available.
   - Available: always a manual staff tap ("Cleaning Done"), from
     either the new KDS "Tables" column (literal 4th board column,
     mockup confirmed live in Stitch) or Admin Tables.
   - Guests scanning a `cleaning` table's QR see a blocked message with
     a "Notify Staff" button (new guest-safe `notify_table_cleaning`
     RPC) if no one's cleaned it yet.
   - Executing the implementation plan now (migration `0021`, query
     layer, 4 UI surfaces, both locale files).
2. **Admin Dashboard using real, live data** — revenue/orders/loyalty
   KPIs and the 7-day chart are still fixed mock numbers (documented,
   not hidden, in CLAUDE.md). Needs real aggregation queries + Realtime.
   Not started — the new Table Status card (part of item 1) is a
   separate, already-real addition to this same dashboard file.

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
