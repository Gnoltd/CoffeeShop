# Today: Customer pages audited against Stitch, order lifecycle connected

## Task

User asked to give customer-facing pages the same "check against Stitch,
fully build real functions" treatment just done for admin. Re-read Menu/
Cart/Checkout/Order Tracking mockups. Profile/Loyalty already matched
their mockups from an earlier session and needed no changes. Found the
big one: Checkout, Order Tracking, and Order History were three
disconnected mock islands — same class of bug as POS/KDS and
Dashboard/Inventory. Also found Cart's promo-code row was never built.

## Context

- Full details: `continuity.md` ("Customer pages audited against Stitch —
  order lifecycle connected" section), `CLAUDE.md` (under "Customer
  ordering flow")
- New: `hooks/useOrders.tsx`
- Changed: `checkout-view.tsx` (builds+stores a real order),
  `order-tracking.tsx` (now a client component reading real order data),
  `order-history.tsx` (reads shared hook), `useCart.tsx` (promo codes),
  `cart-view.tsx` (promo UI + Discount line), root layout (mounts
  `OrdersProvider`)

## Done when

- `npm run build` succeeds, no type errors — done
- curl confirms: Cart's promo code UI renders; looking up seed order
  PDC-9815 through Order Tracking shows its real table (2), real item
  (Cà Phê Trứng), and real status (Ready) instead of the old hardcoded
  mock; an unknown order id still returns 200 via a graceful fallback —
  done
- Order Tracking's table/branch card now correctly shows Pickup vs
  Dine-in instead of always saying Dine-in — done
- Documented (not silently left) that nothing advances a customer order's
  status after creation — customer Checkout and staff Kitchen Display
  remain separate systems for now, connecting them is a bigger job than
  this pass
- Not click-tested in a real browser (placing an order end-to-end, promo
  code entry) — no browser automation tool available in this environment,
  standing caveat for the whole project

## Next session

Every page in the app — customer, staff, and admin — has now been checked
against its Stitch mockup and brought to real interactive parity, with
shared state replacing every disconnected mock-data island found along
the way (POS/KDS, Dashboard/Inventory, and now Checkout/Tracking/History).
Backend is next: Supabase DB schema/RLS/Edge Functions per the
implementation plan, then replace every mock/shared-hook data source with
real queries (+ Realtime where noted).
