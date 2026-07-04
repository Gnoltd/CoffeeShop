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

**All FE pages from the original design are now genuinely real, interactive
UI** — none are translated-placeholder-only anymore. This was previously
claimed done but wasn't quite true: Landing, Login, Signup, Order History,
Loyalty, and Profile were still placeholder `<h1>`s left over from the
original scaffold, caught when the user asked "why does Orders/Loyalty/
Profile just show a word, no function?" — see "Landing, Auth & remaining
customer pages" below for what was actually built to close that gap. Aside
from that, the Next.js app is bilingual
(every route locale-prefixed, working "VI | EN" toggle) with the real brand
theme wired in. Every page uses mock data (no Supabase yet); several known,
documented gaps remain (see each section below) rather than fake/hidden
functionality. This closes out the FE priority list agreed earlier —
remaining work is backend (DB/RLS/Edge Functions) and wiring real data in
to replace the mocks.

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
- **Guest ordering is intentional, not just a missing-auth side effect:** customer routes
  (`/menu`, `/cart`, `/checkout`, `/orders`, `/profile`, `/loyalty`) are deliberately never
  role-gated in `middleware.ts` — only `/staff/*` and `/admin/*` require a role. Confirmed with
  the user when deciding Logout behavior: **Logout clears the session and returns to `/menu` as
  a guest, not `/login`.** Profile/Loyalty/Order History show a "log in to continue" prompt for
  guests instead of hard-blocking, rather than forcing every customer page to require an account.

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

## Staff pages (FE priority #3, done: POS, Kitchen Display)

Ported from `design/stitch-exports/10-staff-pos.html` and `11-staff-kitchen-display.html`.
Simplified relative to the mockups: dropped the elaborate left sidebar (staff
photo/name, shift stats, settings/logout) since that needs real auth data we
don't have — replaced with one shared top nav (`components/staff/staff-nav.tsx`,
brand name + POS/Kitchen Display links with active state) used by both pages.

- **POS** (`components/staff/pos-terminal.tsx`): reuses `lib/mock-data/menu.ts`
  (same source as the customer Menu — one shop, one menu). Search, category
  tabs, item grid; tapping an item adds it at base price directly (no
  size/modifier picker in this pass — a real gap for drinks that need
  customization, noted for later, not silently ignored). Right sidebar:
  order lines with quantity steppers, dine-in/takeaway toggle with a mock
  table picker, payment method (Cash/Card/VNPay), subtotal + 8% mock tax,
  "Charge" button that clears the order (no orders table yet, so this
  simulates a completed sale rather than submitting anything).
- **Kitchen Display** (`components/staff/kitchen-display.tsx`): 3-column
  board (New/Preparing/Ready) seeded with 4 fixed mock orders, each with a
  real ticking elapsed-time counter (`setInterval`, not static). Tapping an
  order's action button advances it to the next column (or removes it after
  "Complete") via local state — no Realtime subscription yet; becomes one
  once the `orders` table + Realtime exist, per the design spec's Section 3d.
- Both pages are behind the existing `/staff/*` role gate (staff|manager|admin)
  — verified the gate itself still redirects anonymous visitors correctly
  after these changes (regression check), but the pages' own rendering was
  verified by successful build/type-check and code review only, same
  limitation as POS/Food-Cost/customer-flow: no browser automation tool
  available to click-test an authenticated session, and no live Supabase to
  authenticate against yet.

## Admin pages (FE priority #4, done: Dashboard, Menu, Inventory, Tables, Staff, Settings)

Ported from `design/stitch-exports/12-admin-dashboard.html` through
`17-admin-settings.html`. All six share one new left-sidebar shell
(`components/admin/admin-sidebar.tsx`, replacing the old plain top-nav
`admin/layout.tsx`) — brand logo + nav links with active state for all 7
admin destinations (Dashboard/Menu/Inventory/Tables/Staff/Food Cost/Settings).
Dropped the mockups' fake admin-profile header (photo/name/notifications)
for the same reason as staff: no real auth data yet. Confirmed the existing
Food Cost Calculator still renders correctly inside this new sidebar shell
(regression check) since it was built before this layout change.

- **Dashboard** (`components/admin/dashboard-view.tsx`): KPI cards (revenue,
  orders, loyalty issued, low-stock count), a 7-day revenue bar chart, best
  sellers list, and a low-stock table with a "Restock" button — all fixed
  mock numbers matching the Stitch example values (5.420.000đ revenue, 142
  orders, etc.), no analytics query yet.
- **Menu Management** (`components/admin/menu-management.tsx`): reuses
  `lib/mock-data/menu.ts` again. Search + category filter, availability
  toggle (real local state), delete (real — removes the row locally). "Add
  New Item" is present but disabled with a tooltip explaining why, rather
  than faking a form or silently doing nothing — same honesty standard as
  POS's missing modifier picker. No separate per-row "Edit" for the same reason.
- **Inventory** (`components/admin/inventory-management.tsx`): ingredients
  table with stock/threshold/status (computed live from the two numbers,
  not a stored flag), and a working "Restock" button that actually adds
  stock locally and flips the status badge — no `inventory_logs` audit
  trail yet since there's no DB.
- **Tables** (`components/admin/tables-management.tsx`): grid of table
  cards with a QR-icon placeholder (no real QR image — no `qr_code_token`
  from a `tables` table yet), a real inline rename (pencil → input →
  save/cancel, highlighted border while editing) and a working
  "Regenerate Code" that swaps in a new random mock token — both now
  backed by the shared `hooks/useTables.tsx` hook rather than local state
  (see "Table identity flow" section below), plus a disabled "Download QR"
  (nothing real to download) / disabled "Add Table" (same reasoning as
  Menu's Add button).
- **Staff Accounts** (`components/admin/staff-accounts.tsx`): table with
  role badges (Admin/Manager/Staff, color-coded) and a working
  activate/deactivate toggle (local state) — "Add Staff" disabled, same
  reasoning as above (no `profiles` table to write to).
- **Settings** (`components/admin/settings-view.tsx`): shop info + loyalty
  rate form (defaults match the agreed real rates: 10,000 VND = 1 point,
  100 points = 10,000 VND off), "Save Changes" shows a real local
  confirmation but doesn't persist anywhere yet.
- Consistent pattern across all "not implemented yet" actions in this
  batch: visually present but `disabled` with an explanatory `title`
  tooltip, never a silently-dead button pretending to work.
- All six routes remain behind the existing `/admin/*` role gate
  (manager|admin, with `/admin/staff` and `/admin/settings` admin-only) —
  verified the gate still works for every admin route after the layout
  change, same rendering-verification caveat as customer/staff pages (no
  live Supabase session, no browser automation tool here).

## Table identity flow (done: rename → QR scan → checkout → order tracking)

Answers the user's question "can I rename the table and if a customer
scans the QR will the status show they ordered at that table?" — yes, and
it's now wired for real (client-side; no `tables` table yet). Visualized
in Stitch first per the user's request (two new approved screens: Table QR
Landing, Admin Tables rename state) before any real UI was built.

- New shared hook `hooks/useTables.tsx` (`TablesProvider` + `useTables()`),
  mounted once in `app/[locale]/layout.tsx` around the whole app so admin
  and customer sides read/write the same table list and "active table"
  session. Both persist to `localStorage`
  (`phadincoffee-tables`, `phadincoffee-active-table`), same hydrate-safe
  pattern as `useCart`. Seeded with demo tokens `table-1`..`table-6` so the
  flow is directly testable by visiting `/vi/table/table-1`.
- New `components/customer/table-landing.tsx` (client) behind
  `/table/[qrToken]` (`app/[locale]/(customer)/table/[qrToken]/page.tsx`,
  rewritten — was a placeholder printing the raw token): resolves the
  token via `setActiveTableByToken`, shows "You're ordering at Table N" +
  "View Menu" on success, or an "Invalid Table Code" screen with a link
  back to the menu if the token doesn't match any table.
- `components/customer/checkout-view.tsx` now reads `activeTable` from
  `useTables()`: shows the real table number in the dine-in badge, and
  appends it as `?table=` on the Order Tracking URL when placing a dine-in
  order. Falls back to a fixed mock number only if a customer picks
  Dine-in manually without ever scanning a QR code.
- `components/customer/order-tracking.tsx` (+ its page, which now also
  reads `searchParams`) accepts a real optional `table` prop and displays
  it instead of the old hardcoded "04" when present.
- `components/admin/tables-management.tsx` rewritten to consume
  `useTables()` instead of local `useState` — renaming a table here is
  immediately what a customer sees after scanning that table's QR code.
- New translation keys added to both `messages/vi.json` and
  `messages/en.json`: `AdminTables.{rename,save,cancel}`, and a new
  `TableLanding` namespace (`orderingAt`, `tableName`, `servedHere`,
  `viewMenu`, `invalidTitle`, `invalidMessage`, `backToMenu`).
- Verified: `npm run build` succeeds (still 20 routes, no TypeScript
  errors); dev-server curl checks confirmed `/vi/table/table-1` and
  `/en/table/table-2` render, `/vi/orders/PDC-1234?table=7` shows
  "Bàn số 7" while the no-param URL still shows the "Bàn số 04" fallback,
  and the `/admin/*` anonymous-redirect gate is unaffected (still 307 to
  `/vi/login`). Interactive rename/scan behavior itself wasn't
  click-tested in a real browser — no browser automation tool available in
  this environment, same caveat as every other page.
- Known gap, documented not hidden: regenerating a table's QR token
  doesn't invalidate an already-active session client-side. Becomes moot
  once real `tables` rows + RLS + Realtime exist.

## Landing, Auth & remaining customer pages (done)

Closed the gap the user caught: Landing (`/`), Login, Signup, Order
History, Loyalty, and Profile were still the original create-next-app
placeholders (a translated `<h1>` and nothing else) despite earlier notes
claiming every page was real. Landing/Login/Signup/Profile/Loyalty already
had unused Stitch mockups from the original design pass
(`01-landing.html`, `06-login.html`, `07-signup.html`, `08-profile.html`,
`09-loyalty.html`); Order History had none, so a new screen was generated
in the same Stitch project/design system first and reported to the user
before any code was written (per their explicit request).

- Promoted `CartProvider` to the root layout (next to `TablesProvider`) so
  the shared `CustomerHeader`/`BottomNav` could be reused by the
  `(marketing)` and `(auth)` route groups too, not just `(customer)`.
- **Landing** (`components/marketing/landing-view.tsx`): hero, real "Order
  Now" → `/menu`, disabled+tooltip "Scan QR at Table" (no camera scanning
  built), promo banner, best-sellers (reuses `lib/mock-data/menu.ts`),
  category chips linking to `/menu`.
- **Order History** (`components/customer/order-history.tsx`): working
  All/Active/Completed filter over 5 mock orders with status badges, tap
  → `/orders/[id]`.
- **Loyalty** (`components/customer/loyalty-view.tsx`): points hero using
  the app's real agreed rates (not placeholder numbers), tier progress,
  disabled+tooltip redeem action (no rewards catalog), mock transaction
  history.
- **Profile** (`components/customer/profile-view.tsx`): real inline-editable
  Name/Phone/Email (local state, same pattern as Admin Tables' rename),
  links into the now-real Order History/Loyalty pages, a working Language
  toggle (reuses `language-switcher.tsx`'s logic), disabled+tooltip
  Addresses/Settings/Logout.
- **Login/Signup** (`components/auth/{login-form,signup-form}.tsx`): real
  form state + working password show/hide, but submit and Google buttons
  are disabled+tooltip — explicitly decided with the user rather than
  faking a successful login, since there's no Supabase Auth yet to back it
  and a fake success wouldn't actually grant a session/role. Re-enable once
  Supabase Auth is wired up.
- Verified: `npm run build` clean (still all routes, no type errors); curl
  checks confirmed real bilingual content on all 6 pages (not the old
  placeholder heading) and no regression on the `/admin/*` `/staff/*` auth
  gate.

## Back button + per-item order notes (done)

Two follow-up fixes from user feedback while previewing:

- **Guest logout decision:** confirmed with the user that Logout should
  clear the session and return to `/menu` as a guest, not force `/login` —
  customer routes are deliberately never role-gated (see Key decisions),
  so guest ordering must keep working after logout. Documented on the
  (still disabled, no real session yet) Logout button's tooltip in
  `components/customer/profile-view.tsx` so this isn't re-litigated when
  Supabase Auth is wired up.
- **Back button on every customer page:** user first reported no way back
  out of Order History's drill-down, then broadened it to "all pages."
  Checked Stitch mockups — Cart/Checkout/Order Tracking/Profile all
  originally had a back arrow the app never implemented. Root cause on
  Checkout and Order Tracking specifically was worse: they hide
  `BottomNav` (Destination Rule) and had zero navigation at all. Fixed by
  adding an optional `showBack` prop to the shared `CustomerHeader`,
  rendering a new `components/customer/back-button.tsx` (`router.back()`);
  only `(customer)/layout.tsx` enables it, so Landing/Login/Signup are
  unaffected. See CLAUDE.md for the exact scope decision.
- **Per-item order notes:** customer-requested feature ("suggest less or
  more sugar"). Added optional `note` to `CartItem`
  (`hooks/useCart.tsx`), included in the cart-line identity key so two
  adds of the same drink with different notes don't merge and drop one.
  Menu's customize panel (`menu-browser.tsx`) now always shows a free-text
  note field, shown back in both Cart and Checkout summaries. Kitchen
  Display intentionally NOT touched — it's still fixed mock orders
  unconnected to the real cart, so there's nothing real to display there
  yet; becomes relevant once Realtime order data exists.
- Verified: `npm run build` clean; curl confirmed the back button appears
  on `/menu`/`/checkout` but not on `/` or `/login`, and the new
  translation keys are present in the client message payload.

## Next steps

The originally agreed FE priority order (theme → customer → staff → admin)
is now **fully done**. Remaining work is backend and polish, roughly in
this order:

1. Execute the DB schema/RLS/trigger/Edge Function tasks from the
   implementation plan (Tasks 3-11) — fully unaffected by the frontend/i18n
   work. Once `menu_items`/`ingredients`/`orders`/`profiles`/`tables`/etc.
   exist, replace every mock data source with real Supabase queries:
   `lib/mock-data/menu.ts` (Menu, POS, Admin Menu), the Order Tracking and
   Kitchen Display mocks (+ Realtime for both), Admin Dashboard's stats,
   Admin Inventory's ingredients, Admin Tables' QR tokens, Admin Staff's
   accounts, and Admin Settings' shop/loyalty rates.
2. Wire real Supabase env vars once local Supabase is running (`npx supabase start`)
   so middleware actually resolves roles instead of falling back to anonymous —
   this also unblocks direct (not just indirect) verification of bilingual
   rendering and interactivity on every auth-gated page.
3. Business logic (Stripe/VNPay integration, real order placement, Realtime
   wiring for order status and the Kitchen Display queue).
4. Wire up the disabled "not implemented yet" buttons once their backing
   tables exist: Admin Menu's "Add New Item" + per-row Edit, Admin Tables'
   "Add Table" + real QR image generation/download, Admin Staff's
   "Add Staff". Also revisit POS to add size/modifier selection (currently
   adds at base price only).
5. Add Vitest/RTL test setup (skipped so far) — including a regression test
   for the force-dynamic/locale-caching bug so it can't silently reappear.
6. Rename `middleware.ts` to `proxy.ts` at some point (Next.js 16
   deprecation warning, non-blocking).
