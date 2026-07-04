# CLAUDE.md

Structural map of the PhaDinCoffee app. Full rationale lives in
`docs/superpowers/specs/2026-07-04-coffee-shop-app-design.md`. A full
implementation plan (DB schema/RLS/Edge Functions) is at
`docs/superpowers/plans/2026-07-04-coffee-shop-scaffold.md` — not yet executed.

## Current reality vs. planned

**Real and running:** Next.js app (App Router, TypeScript, Tailwind v4,
shadcn/ui), bilingual routing (next-intl), role-based middleware, the real
PhaDinCoffee brand theme (colors/font), and **every page in the app is now
real, interactive UI with mock data** — Landing, Login/Signup, the full
customer ordering flow (Menu/Cart/Checkout/Order Tracking/Order
History/Loyalty/Profile) with a real client-side cart, the table QR
identity flow, Food Cost Calculator, both staff pages (POS, Kitchen
Display), and all six admin pages (Dashboard, Menu, Inventory, Tables,
Staff, Settings). `npm run build`/`npm run dev` work. No page is a
translated-heading placeholder anymore — Landing, Login, Signup, Order
History, Loyalty, and Profile were the last six to be ported (see "Landing,
Auth, and remaining customer pages" below); everything before that in this
list was ported in earlier sessions.

**Not yet built:** Supabase database (migrations exist only as comment
stubs), Edge Functions, Stripe/VNPay integration, Realtime — every mock
data source in the app is waiting on these. See each feature section below
for exactly what's mocked and what's a documented (not hidden) gap.

## Stack

Next.js (App Router) + Tailwind v4 + shadcn/ui + next-intl (bilingual
VI/EN), talking directly to Supabase (Postgres + Auth + Realtime) via its
SDK once the DB layer is built. No custom backend server — Row Level
Security (RLS) is the intended access-control boundary. Edge Functions will
handle logic needing secrets or atomicity (payments, order placement).

## Roles

`profiles.role`: `customer | staff | manager | admin`. Staff = fulfillment
(POS + Kitchen Display). Manager = Staff + menu/inventory/tables/reports.
Admin = Manager + staff accounts/roles + shop/loyalty settings.

## Bilingual (i18n)

- Library: **next-intl**, with locale-prefixed routing (`localePrefix: "always"`).
  Every route lives under `app/[locale]/...` — e.g. `/vi/menu`, `/en/menu`.
  Default/primary locale is `vi` (Vietnamese); `en` is the secondary locale.
- Config: `i18n/routing.ts` (locales, default), `i18n/navigation.ts`
  (locale-aware `Link`/`useRouter`/`usePathname`), `i18n/request.ts` (loads
  `messages/{locale}.json` per request). Wired into the build via the
  `next-intl/plugin` wrapper in `next.config.ts`.
- Translation catalogs: `messages/vi.json`, `messages/en.json`, namespaced
  by section (`Brand`, `Nav`, `Landing`, `Auth`, `Customer`, `Staff`, `Admin`,
  `FoodCost`, ...). Add new keys to **both** files. `Brand.name` holds the
  app name ("PhaDinCoffee") — identical in both files since it's a proper
  noun, not translated. Use it instead of hardcoding the name anywhere new.
- Server components: `getTranslations("Namespace")` from `next-intl/server`.
  Client components: `useTranslations("Namespace")` from `next-intl`.
- `app/[locale]/layout.tsx` is the true root layout (`<html lang={locale}>`,
  wraps children in `NextIntlClientProvider` with explicit `locale`/`messages`
  props — **do not** rely on implicit inference, it silently serves the
  wrong locale to client components). It also renders the global
  `<LanguageSwitcher />` (`components/shared/language-switcher.tsx`), a
  fixed top-right "VI | EN" pill that swaps locale via `router.replace(...)`
  while staying on the same page.
- `export const dynamic = "force-dynamic"` is set on the root layout —
  required. Without it, Next.js's route cache served identical (wrong)
  locale content across `/vi/*` and `/en/*` requests in testing. Since every
  route is behind auth-aware middleware anyway, static caching was never
  correct here regardless of the i18n concern.
- **Middleware is required for locale resolution, not just auth.**
  `requestLocale` (used by `getRequestConfig`/`getMessages`/`getTranslations`)
  is only populated correctly when `next-intl`'s middleware handler actually
  runs; disabling/removing `middleware.ts` for any reason (e.g. to test an
  auth-gated page) breaks translations app-wide, silently falling back to
  the default locale. If you need to bypass auth for local testing, do it
  by seeding real Supabase test data/sessions — never by hardcoding a role
  or removing middleware.
- Vietnamese-locale formatting helpers: `lib/format.ts` (`formatVND` →
  `"1.500.000đ"`, `formatNumber`, `formatDateVN` → `DD/MM/YYYY`,
  `formatPhoneVN`).

## Theme (`app/globals.css`)

Brand tokens wired into shadcn's Tailwind v4 CSS-variable theme (no
`tailwind.config.ts` — Tailwind v4 uses `@theme`/`:root` in CSS). Source of
truth: `design/stitch-exports/` (Stitch design system "Highland Red & Brown
Coffee"). Key tokens (light mode): `--primary` `#b3341f` (brick red),
`--secondary` `#6f4e37` (coffee brown), `--accent` `#c9a66b` (caramel),
`--background` `#fff8f2` (warm cream), `--foreground` `#3a2e22` (dark
espresso). `--destructive` (`#c1440e`, burnt orange-red) is deliberately a
different hue from `--primary` so brand red and error red don't look the
same. `--radius: 0.75rem` (12px). A `.dark` variant exists (brightened
primary `#e0533a` on dark espresso background) even with no dark-mode
toggle built yet, to keep shadcn's expected structure complete. Font is
**Be Vietnam Pro** (`app/[locale]/layout.tsx`, `subsets: ["latin", "vietnamese"]`),
wired directly to the `--font-sans` variable — don't reintroduce Geist.
When adding new UI, use the semantic Tailwind classes (`bg-primary`,
`text-muted-foreground`, `border-border`, etc.) rather than hardcoding hex
values, so a future palette change stays a one-file edit.

## Route map

All paths below are relative to the locale prefix (`/vi/...` or `/en/...`);
folders are under `app/[locale]/`.

- `(marketing)` — public landing page (`/`)
- `(auth)` — `/login`, `/signup`
- `(customer)` — `/menu`, `/cart`, `/checkout`, `/orders`, `/orders/[orderId]`,
  `/table/[qrToken]`, `/profile`, `/loyalty`
- `staff` — `/staff/pos`, `/staff/orders`
- `admin` — `/admin/dashboard`, `/admin/menu`, `/admin/inventory`,
  `/admin/tables`, `/admin/food-cost`, `/admin/staff` (admin-only),
  `/admin/settings` (admin-only)

`middleware.ts` composes next-intl's locale routing with role gating for
`/staff/*` (staff|manager|admin) and `/admin/*` (manager|admin, with
`/admin/staff` and `/admin/settings` further restricted to admin). It fails
open to "anonymous" (redirects to `/login`) rather than crashing when
Supabase is unreachable/unconfigured.

**Note:** `staff` and `admin` are real URL-segment folders (not parenthesized
route groups like `(customer)`) — Next.js route groups are invisible in the
URL, so parenthesized `(staff)`/`(admin)` groups would have collided with
`(customer)`'s bare paths (`/menu`, `/orders`). Caught and fixed during planning.

## Food Cost Calculator (`/admin/food-cost`)

First real feature built (not a placeholder). `components/admin/food-cost-calculator.tsx`
(client component) + thin `app/[locale]/admin/food-cost/page.tsx` wrapper.
Formula: `Food Cost Used = Beginning Inventory + Purchases - Ending Inventory`;
`Food Cost % = Food Cost Used / Food Sales × 100`. Status thresholds: <28% good
(green), 28-32% normal (amber), >32% needs improvement (red). Fully bilingual
via the `FoodCost` message namespace; uses the shared brand (brick red
#B3341F, Be Vietnam Pro, shadcn components) rather than a separate palette.
Responsive: 1-column mobile, 2-column tablet (≥768px), 3-column desktop
(≥1024px) input grid; all interactive controls are ≥44px for touch.

## Customer ordering flow (`/menu`, `/cart`, `/checkout`, `/orders/[orderId]`)

Real, interactive pages ported from `design/stitch-exports/02-menu.html`
through `05-order-tracking.html` — not placeholders. Components live in
`components/customer/`. Shared layout: `(customer)/layout.tsx` renders
`CustomerHeader` (brand bar) + `BottomNav` (tab bar that hides itself on
`/checkout` and `/orders/[id]`, which have their own sticky action bar —
matches the Stitch mockups' "Destination Rule" for focused pages).

- `hooks/useCart.tsx` — real cart state (React Context + localStorage), not
  mocked. `addItem`/`updateQuantity`/`removeItem`/`clear`, computed
  `subtotal`/`itemCount`. Wrap any new customer page that needs cart access
  in the existing `CartProvider` (already in the customer layout).
- `lib/mock-data/menu.ts` — placeholder menu items/categories/sizes/modifiers
  until `menu_items` etc. exist in Supabase. Uses `nameVi`/`nameEn` directly;
  the planned DB schema only has one `name` column, so this needs a decision
  later (translation columns vs. Vietnamese-only content).
- Order Tracking (`components/customer/order-tracking.tsx`) shows a fixed
  mock status regardless of the URL's `orderId` — no `orders` table or
  Realtime yet. "Place Order" on Checkout clears the cart and navigates
  there; it does not submit anything anywhere. It now accepts a real
  optional `table` prop (from the URL's `?table=` search param, read by
  `app/[locale]/(customer)/orders/[orderId]/page.tsx`) and shows that
  number instead of a hardcoded one when present — see "Table identity
  flow" below.
- Checkout (`components/customer/checkout-view.tsx`) reads `activeTable`
  from `useTables()` — if the customer arrived via a table's QR code, the
  dine-in badge shows the real table number and it's appended as
  `?table=` on the Order Tracking URL. Falls back to a fixed mock number
  only if Dine-in is picked manually without ever scanning a QR code.
- Item "photos" are lucide-react icon placeholders in a colored box, not
  real images — the Stitch exports' image URLs point at Google's internal
  AI-generation service and aren't stable to hardcode into the app.
- **Gotcha:** this project's shadcn `Button` wraps **Base UI**
  (`@base-ui/react/button`), not Radix — there is no `asChild` prop. For
  polymorphic rendering (e.g. a `Button` that navigates), use Base UI's
  `render` prop: `<Button render={<Link href="/x" />}>text</Button>`, not
  `<Button asChild><Link>...</Link></Button>`. Base UI's `Button` also
  defaults `nativeButton` to `true`, which expects the rendered element to
  literally be a `<button>` — since `Link` renders an `<a>`, always pass
  `nativeButton={false}` alongside `render={<Link .../>}` or it logs a dev
  warning about lost native button semantics.

## Landing, Auth, and remaining customer pages (`/`, `/login`, `/signup`, `/orders`, `/loyalty`, `/profile`)

The last six pages ported from placeholder to real UI. All six were designed
in Stitch first: Landing/Profile/Loyalty/Login/Signup already had exports
(`01-landing.html`, `08-profile.html`, `09-loyalty.html`, `06-login.html`,
`07-signup.html`) from the original design pass that had never been ported;
Order History had no prior mockup, so a new screen was generated in the
same Stitch project/design system (`projects/4654820544595168289`,
screen `8436df098abc43ea801649f367476650`) before building it for real.

- **Structural change:** `CartProvider` moved from `(customer)/layout.tsx`
  up to the root `app/[locale]/layout.tsx` (alongside `TablesProvider`), so
  `components/customer/header.tsx` and `components/customer/bottom-nav.tsx`
  can be reused outside the `(customer)` route group. `(marketing)/layout.tsx`
  and `(auth)/layout.tsx` now both render the same shared `CustomerHeader`;
  `(marketing)` also renders `BottomNav` (matches its Stitch mockup, which
  shows the same tab bar as the rest of the app). `(auth)` deliberately does
  **not** render `BottomNav` — matches the Login mockup's explicit "No
  Bottom Navigation as per Transactional Flow Rules" note, consistent with
  the existing Checkout/Order Tracking "Destination Rule".
- **Landing** (`components/marketing/landing-view.tsx`, ported from
  `01-landing.html`): hero with headline + a real "Order Now" button
  (→ `/menu`) and a disabled+tooltip "Scan QR at Table" button (no
  camera-based QR scanning implemented — customers reach `/table/[qrToken]`
  by literally scanning a printed code with their phone's camera app, not
  from inside this app), a promo banner, a best-sellers horizontal scroll
  (reuses `lib/mock-data/menu.ts`), and category chips that link to `/menu`
  (not pre-filtered — `menu-browser.tsx` has no query-param filtering).
- **Order History** (`components/customer/order-history.tsx`, no prior
  mockup): filter pills (All/Active/Completed — Active = preparing/ready,
  Completed = completed/cancelled), 5 fixed mock orders with color-coded
  status badges, tapping a card navigates to `/orders/[id]`. Becomes a real
  Supabase query (+ Realtime for active orders) once `orders` exists.
- **Loyalty** (`components/customer/loyalty-view.tsx`, ported from
  `09-loyalty.html`): points hero card using the app's real agreed rates
  (10,000 VND = 1 point, 100 points = 10,000 VND off — not placeholder
  numbers), tier progress bar, a disabled+tooltip "Redeem Rewards" card (no
  rewards catalog table), a promo card, and a mock transaction history list
  with a disabled+tooltip "View All" (no pagination without a backend).
- **Profile** (`components/customer/profile-view.tsx`, ported from
  `08-profile.html`): avatar placeholder with disabled+tooltip edit (no
  upload backend), three real inline-editable fields (Name/Phone/Email —
  local state only, same pencil→input→save/cancel pattern as Admin Tables'
  rename), a menu list linking to the now-real Order History and Loyalty
  pages, a **functional** Language row (reuses the same locale-switch logic
  as `components/shared/language-switcher.tsx`), and disabled+tooltip
  Addresses/Settings/Logout rows (no addresses table, no customer settings
  page, and no real auth session to log out of, respectively).
- **Login / Signup** (`components/auth/login-form.tsx` +
  `signup-form.tsx`, ported from `06-login.html`/`07-signup.html`): real
  form state and a working show/hide password toggle, but the actual
  submit buttons (Log In / Create Account) and the Google buttons are
  **disabled+tooltip** — there is no Supabase Auth wired up yet, so a
  button that looked like it logged you in without granting any real
  session would be actively misleading. Re-enable these once Supabase Auth
  exists. Shared Google "G" icon lives in `components/auth/google-icon.tsx`
  (used by both forms, avoids duplicating the inline SVG).
- New translation namespaces: `TableLanding` (from the earlier table-flow
  work), `OrderHistory`, `Loyalty`, `Profile`; expanded `Landing` and
  `Auth`. All added to both `messages/vi.json` and `messages/en.json`.

## Staff pages (`/staff/pos`, `/staff/orders`)

Real, interactive pages ported from `design/stitch-exports/10-staff-pos.html`
and `11-staff-kitchen-display.html`, simplified to drop chrome that needs
real auth data (staff photo/name, shift stats) we don't have yet. Shared nav:
`components/staff/staff-nav.tsx` (brand name + POS/Kitchen Display links).

- **POS** (`components/staff/pos-terminal.tsx`) reuses `lib/mock-data/menu.ts`
  (same menu source as the customer app). Tapping an item adds it at base
  price directly — there is no size/modifier picker here yet, unlike the
  customer Menu page; that's a known gap, not an oversight, tracked in
  continuity.md. Local component state only (not `useCart` — POS is a
  separate staff-side transaction, not a shared persisted cart).
- **Kitchen Display** (`components/staff/kitchen-display.tsx`) is a 3-column
  board (New/Preparing/Ready) with a real ticking elapsed-time counter per
  order (`setInterval`). Advancing an order is local state only — becomes a
  Realtime subscription on `orders` once that table exists (design spec
  Section 3d).
- Both routes are still gated by the existing `/staff/*` middleware rule
  (staff|manager|admin) — confirmed the gate itself wasn't broken by these
  changes, but couldn't verify the pages' own rendering against a real
  authenticated session (no live Supabase yet, and no browser automation
  tool in this environment) — same caveat as the Food Cost Calculator.

## Admin pages (`/admin/dashboard`, `/menu`, `/inventory`, `/tables`, `/staff`, `/settings`)

Real, interactive pages ported from `design/stitch-exports/12-admin-dashboard.html`
through `17-admin-settings.html`. All admin routes (including the
pre-existing Food Cost Calculator) now share one left-sidebar shell:
`components/admin/admin-sidebar.tsx` + `app/[locale]/admin/layout.tsx`
(replaced the old plain top-nav). Dropped the mockups' fake admin-profile
header for the same reason as staff — no real auth data yet.

- `components/admin/{dashboard-view,menu-management,inventory-management,tables-management,staff-accounts,settings-view}.tsx`
  — one component per page, each with its own local mock data (Menu
  Management reuses `lib/mock-data/menu.ts`; the rest define their mocks
  inline since nothing else needs them).
- **Convention for not-yet-backed actions:** every "Add X" button
  (Menu/Tables/Staff) is rendered `disabled` with an explanatory `title`
  tooltip ("Not implemented yet — no `<table>` to write to") rather than
  silently doing nothing or faking success — keep this pattern for any new
  admin action that has no real table to persist to yet.
- Actions that only need **local** state (no persistence) are implemented
  for real, not stubbed: Menu's availability toggle + delete, Inventory's
  restock (increments stock and flips the status badge), Tables' rename
  and QR token regeneration (via the shared `useTables()` hook — see
  "Table identity flow" below), Staff's activate/deactivate toggle,
  Settings' save (shows a real confirmation, doesn't persist).
- Dashboard's KPI numbers, chart, best-sellers, and low-stock table are
  fixed mock data matching the approved Stitch example values — no
  analytics query yet.
- All six routes remain behind the existing `/admin/*` middleware rule
  (manager|admin, with `/admin/staff` and `/admin/settings` admin-only) —
  confirmed the gate still works for every route (including Food Cost)
  after the layout change; same rendering-verification caveat as
  staff/customer pages (no live Supabase session, no browser automation
  tool here).

## Table identity flow (`/table/[qrToken]` → Checkout → Order Tracking)

Connects an admin-renamed table's identity all the way through to a
customer's order, entirely client-side (no `tables` table yet).

- `hooks/useTables.tsx` — `TablesProvider` + `useTables()`, mounted app-wide
  in `app/[locale]/layout.tsx` (outside/around everything, so both the
  admin and customer sides share one source of truth). Holds the table
  list (`{ id, number, qrToken }[]`, seeded with demo tokens `table-1`
  through `table-6` so the flow is testable by visiting `/vi/table/table-1`
  directly) and the current `activeTable` session. Both persist to
  `localStorage` independently (`phadincoffee-tables`,
  `phadincoffee-active-table`) with the same hydrate-then-persist pattern
  as `useCart`. `setActiveTableByToken(token)` looks up a table by its QR
  token, sets it as the active session, and returns it (or `null` if the
  token doesn't match any table).
- `components/customer/table-landing.tsx` — client component rendered by
  `/table/[qrToken]`. Calls `setActiveTableByToken` on mount; shows a
  "You're ordering at Table N" screen with a "View Menu" button on success,
  or an "Invalid Table Code" screen with a link back to the menu if the
  token doesn't match (e.g. a stale/regenerated QR code).
- Checkout reads `activeTable` and shows/forwards the real number (see
  "Customer ordering flow" above).
- Admin Tables' rename (`components/admin/tables-management.tsx`) writes
  through the same hook, so renaming "Table 3" to e.g. "Patio 1" is
  immediately what a customer sees after scanning that table's QR code.
- Gap, documented not hidden: token regeneration doesn't invalidate a
  currently-active session client-side (mirrors how a real QR reprint
  wouldn't affect an order already in progress) — becomes moot once real
  `tables` rows + RLS exist.

## Database (`supabase/migrations/`)

Not yet built — files are still comment-only placeholders in intended apply
order: `0001_identity_and_roles` → `0002_shop_config` → `0003_menu` →
`0004_inventory` → `0005_orders` → `0006_payments_and_loyalty` →
`0007_handle_order_paid`. Full entity list: spec Section 2. Full SQL for
every migration already exists in the plan doc's Tasks 3–9.

## Edge Functions (`supabase/functions/`)

Not yet built — `place-order`, `stripe-webhook`, `vnpay-ipn`, `vnpay-return`
are still comment-only `index.ts` stubs. Full handler code (with tests) is
in the plan doc's Task 11.

## Building the rest

All `design/stitch-exports/*.html` pages have been ported — there is no
remaining frontend UI to port from Stitch. What's left is backend: follow
`docs/superpowers/plans/2026-07-04-coffee-shop-scaffold.md` for the
DB/RLS/Edge Function tasks (unaffected by the frontend/i18n work), then go
through every component listed in this file's feature sections and replace
its mock data with real Supabase queries (+ Realtime where noted). When
adding any genuinely new page/feature beyond what's already built, follow
the same pattern used throughout: shared brand tokens (no hardcoded hex),
`useTranslations`/`getTranslations` for every label with both
`messages/vi.json` and `messages/en.json` updated together, Base UI's
`render` prop (not `asChild`) for polymorphic Buttons, and the "disabled +
tooltip" convention for any action with no backing table yet.
