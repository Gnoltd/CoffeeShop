# Today: Guest-logout decision, universal back button, per-item order notes

## Task

Three follow-ups from the user previewing the app live:
1. Clarified Logout should return guests to `/menu`, not force `/login`
   (customer routes are intentionally never auth-gated).
2. User couldn't navigate out of Order History's drill-down — traced to
   Checkout and Order Tracking hiding the bottom tab bar with zero
   replacement navigation. Added a back button to every customer page.
3. Added a free-text per-item note field ("less sugar", "extra ice") to
   the Menu customize flow, shown through Cart and Checkout.

## Context

- Full details: `continuity.md` ("Back button + per-item order notes"
  section), `CLAUDE.md` (same)
- New: `components/customer/back-button.tsx`
- Changed: `components/customer/header.tsx` (new `showBack` prop),
  `app/[locale]/(customer)/layout.tsx`, `hooks/useCart.tsx` (new `note`
  field), `components/customer/{menu-browser,cart-view,checkout-view,
  profile-view}.tsx`

## Done when

- `npm run build` succeeds, no type errors — done
- curl confirms back button present on `/menu` and `/checkout`, absent on
  `/` and `/login` — done
- Note field translation keys present in the client message payload —
  done; actual textarea interaction not click-tested (no browser
  automation tool available in this environment, standing caveat)
- Logout tooltip documents the intended guest-friendly behavior for when
  Supabase Auth lands — done

## Next session

Same as before: nothing left on the frontend that isn't a documented,
intentional gap. Backend is next — Supabase DB schema/RLS/Edge Functions,
then replace every mock data source with real queries (+ Realtime), then
re-enable the disabled Login/Signup/Logout/Admin-Add buttons as their real
tables/auth land.
