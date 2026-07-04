# Project: PhaDinCoffee — Management & Customer Portal

## Goal

Web app for a single-location coffee shop ("PhaDinCoffee"): customer ordering
(pickup + dine-in QR), staff POS + Kitchen Display, manager/admin
menu/inventory/reporting/settings. Full spec: `docs/superpowers/specs/2026-07-04-coffee-shop-app-design.md`.
Bilingual product: single language per page (VI or EN, default VI), switchable
via a toggle — not a dual-language-at-once display (confirmed with the user;
the earlier Stitch mockups showed both languages together, but the real app
intentionally works differently).

## Current status

Next.js app is real, running, and genuinely bilingual (every route
locale-prefixed, working "VI | EN" toggle), with the real brand theme wired
in. Real (non-placeholder) features so far: Food Cost Calculator
(`/admin/food-cost`) and the full customer ordering flow — Menu, Cart,
Checkout, Order Tracking — all interactive with mock data and a working
client-side cart. Staff and admin pages (besides Food Cost) are still
translated placeholder headings. No Supabase database yet.

## Completed

- Design spec + implementation plan (see `docs/superpowers/` and CLAUDE.md) — DB/RLS/Edge
  Function tasks from the plan (Tasks 3-11) not yet executed
- Visual design in Stitch: 17 screens + exact HTML exports in `design/stitch-exports/`
  (see CLAUDE.md and prior notes — not yet ported into real components except food-cost,
  which was built fresh rather than ported from a Stitch export)
- **Next.js app scaffolded for real**: create-next-app, shadcn/ui, Supabase client
  libs, middleware, all 20 routes buildable — see prior session details in CLAUDE.md
- **Bilingual system (next-intl), built this session:**
  - `i18n/routing.ts`, `i18n/navigation.ts`, `i18n/request.ts`, `next.config.ts` plugin wiring
  - `messages/vi.json` + `messages/en.json` covering nav labels, all page headings, and
    the full Food Cost Calculator UI text
  - Every route moved from `app/...` to `app/[locale]/...` (all 20 original routes preserved)
  - `app/[locale]/layout.tsx` rebuilt as the true root layout: `<html lang={locale}>`,
    `NextIntlClientProvider` with **explicit** `locale`/`messages` props, global
    `<LanguageSwitcher />` pill (fixed top-right)
  - `middleware.ts` composes next-intl's locale routing with the existing role-based
    redirect logic — verified: bare `/` → 307 to `/vi`, protected routes redirect to the
    *same-locale* `/login` (e.g. `/en/staff/pos` anon → `/en/login`)
  - All 20 placeholder pages/layouts converted from hardcoded English strings to
    `getTranslations`/`useTranslations` calls
  - **Bug found and fixed during verification:** Next.js's route cache was serving
    identical (wrong-locale) content across `/vi/*` and `/en/*` — fixed by adding
    `export const dynamic = "force-dynamic"` to the root layout and removing
    `generateStaticParams` (static caching was never correct anyway, since every
    route sits behind dynamic auth middleware). Root-caused via a temporary debug
    log (removed after confirming the fix) rather than guessing.
  - **Learned the hard way:** next-intl's `requestLocale` (used by `getMessages`/
    `getTranslations`) only resolves correctly when the middleware actually runs.
    Temporarily disabling `middleware.ts` to test an auth-gated page (to bypass the
    Supabase-less auth wall) silently broke translations app-wide, not just auth —
    documented in CLAUDE.md so this isn't rediscovered by surprise later.
  - **Declined a bad shortcut:** hardcoding `role = "admin"` in middleware to bypass
    the auth wall for local testing was correctly blocked by the environment's
    security classifier (a real RBAC weakening, even though intended as temporary).
    Food Cost Calculator's bilingual rendering was therefore verified indirectly —
    directly, via public routes sharing the identical layout/provider mechanism —
    rather than by weakening auth. Direct proof on the auth-gated route itself will
    come naturally once real Supabase auth exists.
- **Food Cost % Calculator** (`/admin/food-cost`) — first real feature, not a placeholder:
  - `components/admin/food-cost-calculator.tsx` (client component) + thin page wrapper
  - Formula: `Food Cost Used = Beginning + Purchases - Ending`; `Food Cost % = Used / Sales × 100`
  - Status badges: <28% good (green) / 28-32% normal (amber) / >32% needs improvement (red)
  - Validation: rejects empty/negative/non-numeric fields, and food sales ≤ 0, with translated errors
  - Verified against the user's sample calculation: 50M + 120M - 45M = 125.000.000đ,
    125M / 400M × 100 = 31.3% → "Bình Thường"/"Normal" ✓
  - Fully bilingual via the `FoodCost` message namespace; uses the app's existing brand
    (brick red #B3341F, Be Vietnam Pro, shadcn) rather than the pasted spec's separate
    "VietFood" red (#D62828) — confirmed with the user
  - Responsive: 1-col mobile / 2-col tablet (≥768px) / 3-col desktop (≥1024px) input grid;
    buttons/inputs are `h-11` (44px) for touch
  - Currency/number formatting via new `lib/format.ts` (`formatVND` → "1.500.000đ" pattern,
    plus `formatNumber`, `formatDateVN`, `formatPhoneVN` for future use)
  - Added "Food Cost" as a new nav item in the admin layout nav list

## Key decisions

- Supabase-only backend (no custom Express/API server) — RLS will be the real security boundary
- Single location, no branches table
- Loyalty: admin-configurable rates, defaults 10,000 VND spent = 1 point, 100 points = 10,000 VND discount
- Payments: Stripe (card), Cash, VNPay — all sandbox for now
- `staff` and `admin` are real URL-segment folders, not route groups (see CLAUDE.md)
- Visual style: warm/cozy, brick red (#B3341F) + coffee brown (#6F4E37) + caramel (#C9A66B) + cream (#F3E9DD),
  Be Vietnam Pro font, ROUND_TWELVE (~12px) corners
- **i18n: next-intl with locale-prefixed routing** (`/vi/...`, `/en/...`), Vietnamese as default
  locale — chosen over a lightweight cookie-only approach; user explicitly wanted full next-intl
  despite the bigger route-restructuring cost. `dynamic = "force-dynamic"` on the root layout is
  required, not optional — see CLAUDE.md.
- New features (like Food Cost Calculator) reuse the app's existing brand/design system rather
  than any separate branding pasted in from a spec — confirmed with the user rather than assumed.
- Middleware fails open to "anonymous" (not a crash) when Supabase is unreachable/unconfigured

## Brand rename

App renamed from generic "Coffee Shop" to **"PhaDinCoffee"** (same string in both
locales — it's a proper noun, not translated). Updated: `messages/{vi,en}.json`
(new `Brand.name` key), marketing header, root layout `<title>`, `package.json`
`name` (was still the leftover `coffeeshop-tmp` from the initial scaffold —
fixed as part of this), README, CLAUDE.md. Historical spec/plan docs in
`docs/superpowers/` were left as-is (they're a record of decisions at the time,
not live app content). Note: there is a separate, unrelated `PhaDinCoffee`
project folder on the user's Desktop with its own Vite-based dev servers —
untouched by this rename, just worth being aware of.

## Theme wired (FE priority #1, done)

`app/globals.css` now carries the real PhaDinCoffee brand instead of shadcn's
default gray theme:
- Colors (light): `--primary` brick red `#b3341f`, `--secondary` coffee brown
  `#6f4e37`, `--accent` caramel `#c9a66b`, `--background` warm cream `#fff8f2`,
  `--foreground` dark espresso `#3a2e22`, `--muted` `#f3e9dd`, `--border`/`--input`
  `#e8dcc8`. `--destructive` is a distinct burnt orange-red `#c1440e` (not the
  same hue as `--primary`, so "error" and "brand" don't visually collide).
- A coherent `.dark` variant also defined (brightened primary `#e0533a` for
  contrast on a dark espresso `#241b12` background) even though no dark-mode
  toggle UI exists yet — keeps shadcn's expected structure consistent.
- `--radius: 0.75rem` (12px, matches Stitch's `ROUND_TWELVE`).
- Font switched from the default Geist to **Be Vietnam Pro** (`app/[locale]/layout.tsx`),
  loaded with `subsets: ["latin", "vietnamese"]` for full diacritic coverage,
  wired directly into the `--font-sans` CSS variable (the shadcn-generated
  `--font-sans: var(--font-sans)` line in `@theme inline` was a circular
  no-op until this — previously the app was silently falling back to the
  system font stack instead of actually using a custom font).
- Verified: compiled CSS output contains `--primary: #b3341f` (light) /
  `#e0533a` (dark) and resolves `--font-sans` to `"Be Vietnam Pro"`; build
  and dev server both clean, no errors.
- Chart colors (`--chart-1..5`) and sidebar tokens (`--sidebar-*`) also set
  to brand-consistent values even though unused yet (dashboard/admin nav
  will need them later) — avoids a second pass.

## Customer ordering flow (FE priority #2, done: Menu/Cart/Checkout/Order Tracking)

Ported from `design/stitch-exports/02-menu.html` through `05-order-tracking.html`
into real, interactive components — not just translated headings like the
rest of the app. All four pages share one `(customer)` layout with a
branded header (`components/customer/header.tsx`) and a bottom tab bar
(`components/customer/bottom-nav.tsx`) that hides itself on focused
single-task pages (`/checkout`, `/orders/[id]`) to avoid competing with
their own sticky action bar — matching the Stitch mockups' explicit
"Destination Rule" for those two screens.

- **Mock data, not Supabase** (menu_items/etc. don't exist yet): `lib/mock-data/menu.ts`
  — 9 items across 4 categories, with sizes (S/M/L) and a milk modifier group on
  some items. Uses `nameVi`/`nameEn` fields directly since the planned DB schema
  (design spec Section 2) only has a single `name` column — worth deciding later
  whether menu content itself needs translation columns, or whether only the app
  chrome stays bilingual and menu item names are entered once.
- **Real client-side cart**, not mocked: `hooks/useCart.tsx` — React Context +
  localStorage persistence (hydrated client-side only, no SSR mismatch), add/
  update-quantity/remove/clear, computed subtotal/itemCount. Used live by Menu
  (add items, floating "View Cart" bar), Cart (edit quantities, remove, proceed),
  Checkout (summary, total), and the bottom nav's cart badge.
- **Menu** (`components/customer/menu-browser.tsx`): search, category filter chips,
  tap-to-expand item cards with size/modifier selection and live price calc, direct
  "+" add for simple items. Item images are icon placeholders in a colored box
  (lucide-react `Coffee`/`CupSoda`/`Cookie`/`Milk`) — the Stitch exports' image URLs
  are Google's internal AI-generation service, not stable/production URLs, so they
  were deliberately not carried over. Swap for real photos when available.
- **Cart** (`components/customer/cart-view.tsx`): line items with quantity steppers,
  remove, subtotal/total, empty state, "Proceed to Checkout".
- **Checkout** (`components/customer/checkout-view.tsx`): pickup/dine-in toggle
  (mock table "04" when dine-in), pickup time select, order summary from real
  cart state, mock loyalty redemption (150 pts balance, 50 pts = 10,000đ — matches
  the Stitch example; real rates come from `loyalty_settings` once it exists),
  payment method picker (Stripe/Cash/VNPay), sticky total bar. "Place Order"
  clears the cart and navigates to `/orders/{mock-id}` — there's no orders table
  yet, so this is a UI-only simulation of a successful order, not a real submission.
- **Order Tracking** (`components/customer/order-tracking.tsx`): fixed mock status
  ("Preparing", step 2 of 4) regardless of the `orderId` in the URL — becomes a
  real Realtime-subscribed query once Supabase's `orders` table + trigger exist.
  "Contact Shop" is a real `tel:` link (works without any backend).
- **Gotcha for next time:** this project's shadcn `Button` is built on **Base UI**
  (`@base-ui/react/button`), not Radix — it has no `asChild` prop. Polymorphic
  rendering (e.g. a `Button` that's actually a `Link`) uses Base UI's `render`
  prop instead: `<Button render={<Link href="/x" />}>text</Button>`. Caught by
  a build error, not a runtime bug, but worth knowing before reaching for the
  Radix pattern from habit.
- Verified: `npm run build` succeeds (still 20 routes), and all 4 pages return
  200 with correct bilingual server-rendered content on both `/vi/*` and `/en/*`.
  Interactive behavior (add-to-cart, quantity steppers, place-order navigation)
  was verified by code review and successful TypeScript compilation, not by
  driving a real browser — no browser automation tool is available in this
  environment, same limitation noted for the Food Cost Calculator earlier.

## Next steps (FE priority order, confirmed with user)

1. Port remaining Stitch pages: **staff** (POS, Kitchen Display), then **admin**
   (Dashboard, Menu, Inventory, Tables, Staff, Settings) — same template as the
   customer flow: mock data, real interactivity where sensible, both message
   files updated together, `render` prop (not `asChild`) for polymorphic Buttons.
2. Execute the DB schema/RLS/trigger/Edge Function tasks from the implementation
   plan (Tasks 3-11) — fully unaffected by the frontend/i18n work, can happen
   in parallel with #1. Once `menu_items`/`orders`/etc. exist, replace
   `lib/mock-data/menu.ts` and the Order Tracking mock with real Supabase queries.
3. Wire real Supabase env vars once local Supabase is running (`npx supabase start`)
   so middleware actually resolves roles instead of falling back to anonymous —
   this also unblocks direct (not just indirect) verification of bilingual
   rendering on auth-gated pages.
4. Business logic (Stripe/VNPay integration, real order placement, Realtime wiring
   for order status and the Kitchen Display queue).
5. Add Vitest/RTL test setup (skipped so far) — including a regression test for
   the force-dynamic/locale-caching bug so it can't silently reappear.
6. Rename `middleware.ts` to `proxy.ts` at some point (Next.js 16 deprecation
   warning, non-blocking).
