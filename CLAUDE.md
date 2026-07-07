# CLAUDE.md

Structural map of the PhaDinCoffee app. Full rationale lives in
`docs/superpowers/specs/2026-07-04-coffee-shop-app-design.md`. A full
implementation plan (DB schema/RLS/Edge Functions) is at
`docs/superpowers/plans/2026-07-04-coffee-shop-scaffold.md` — not yet executed.

## Current reality vs. planned

**Real and running:** Next.js app (App Router, TypeScript, Tailwind v4,
shadcn/ui), bilingual routing (next-intl), role-based middleware, the real
PhaDinCoffee brand theme (colors/font), and **every page in the app is now
real, interactive UI** — Landing, the full customer ordering flow
(Menu/Cart/Checkout/Order Tracking/Order History/Loyalty/Profile) with a
real client-side cart, the table QR identity flow, Food Cost Calculator,
both staff pages (POS, Kitchen Display), and all six admin pages
(Dashboard, Menu, Inventory, Tables, Staff, Settings). `npm run build`/
`npm run dev` work. No page is a translated-heading placeholder anymore.
Most of these still read from `lib/mock-data/*` and local hooks pending
Supabase query wiring (see "Building the rest" below) — **Login, Signup,
and Logout are the first slice now backed by real Supabase Auth**, not
mock data (see "Landing, Auth, and remaining customer pages" below).

**Now built:** the Supabase database — 17 migrations
(`supabase/migrations/0001`-`0017`) are applied to the live hosted project
(`qhiypdqnrnzndxdwqxbx`), every table has RLS enabled, and a real admin
account exists (`profiles.role = 'admin'`). Real Supabase Auth now backs
Login/Signup/Logout. Menu data (items/categories/sizes/modifier
groups/extras) is real — migrations `0008`/`0009` and
`lib/supabase/menu-data.ts`, see "Customer ordering flow" below.
Inventory (ingredients/stock/logs/recipes), Tables
(directory/location/occupied/scan-count/QR tokens), Orders (Cash
payment end-to-end, unifying customer tracking with staff POS/Kitchen
Display), and Staff accounts (real Supabase Auth account creation, an
`is_active` disable mechanism, a real staff directory) are also real,
with **live Realtime sync** across sessions — migrations `0010`/`0011`,
`0012`/`0013`, `0014`/`0015`, and `0016`/`0017` respectively;
`lib/supabase/inventory-data.ts`/`lib/supabase/tables-data.ts`/
`lib/supabase/orders-data.ts`/`lib/supabase/staff-data.ts`; see "Admin
pages"/"Table identity flow"/"Real orders + Realtime"/"Staff accounts +
Realtime" below. This completes all four sub-projects of the "make all
data real-time" initiative. **All three payment methods are now real —
Cash, Stripe, and VNPay** (migration `0018`, `place-order` extended
twice, plus `stripe-webhook`/`vnpay-ipn`/`vnpay-return`) — see "Stripe
payment integration" and "VNPay payment integration" below. This closes
out the entire payments follow-up from the Orders Realtime spec; no
payment-related backend work remains deferred. See each feature section
below for exactly what's mocked and what's a documented (not hidden) gap.

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
- `lib/supabase/menu-data.ts` — real menu data. `menu_items`/`categories`/
  `menu_item_sizes`/`modifier_groups`/`modifiers` exist in Supabase (migration
  `0008`) and are seeded with the real menu (migration `0009`); this module is
  the shared query layer (`getCategories`, `getMenuItems`, `getMenuItemById`,
  `createMenuItem`, `updateMenuItem`, `deleteMenuItem`) every menu-reading
  page now calls instead of importing a mock array. The old
  `lib/mock-data/menu.ts` placeholder (with its `nameVi`/`nameEn`-only-columns
  open question) is gone — the schema resolved that question with real
  `name_vi`/`name_en` columns, mapped to the same camelCase shape client code
  already expected.
- **The full order lifecycle is now genuinely connected** — Checkout,
  Order Tracking, and Order History used to be three disconnected mock
  islands (a placed order's real items/notes never actually showed up in
  tracking or history). Fixed with `hooks/useOrders.tsx` (Context+Provider,
  mounted at the root layout next to `useCart`/`useTables`):
  - Checkout's "Place Order" builds a real `OrderRecord` (actual cart
    items with their notes, subtotal, discount, table, order type) and
    calls `addOrder()` **before** clearing the cart and navigating.
  - Order Tracking (`components/customer/order-tracking.tsx`, now a client
    component) looks up the order by id in `useOrders()` — real items,
    per-item notes, discount, and table render when found. An id not in
    the store (stale link, hand-typed URL) falls back to a fixed mock
    order rather than crashing, same honesty-with-a-safety-net pattern
    used elsewhere. The progress-step shown is driven by the order's real
    `status` field, not a hardcoded step index — though nothing currently
    *advances* that status after creation (new orders start at
    `"preparing"` and stay there — no staff-side actor moves customer
    orders forward yet; that's a real gap, not a bug, since customer
    Checkout orders and the staff Kitchen Display board remain separate
    systems for now, see "Staff pages" below).
  - Order History reads from the same `useOrders()` list (sorted by
    `createdAt` descending) instead of its own separate mock array, so a
    just-placed order appears at the top immediately.
  - Seed data: the 5 example orders migrated from Order History's old
    local mock into `useOrders.tsx`'s `SEED_ORDERS`, now with full
    `subtotal`/`discount`/`table`/`orderType` fields so they render
    correctly in Order Tracking too (previously Order History and Order
    Tracking had two unrelated, incompatible mock shapes for "an order").
- **Cart promo codes** (`hooks/useCart.tsx`): one hardcoded valid code,
  `WELCOME10` (10% off subtotal) — real validation, real discount, shown
  in both Cart and Checkout's summary as a "Discount" line. `clear()`
  resets the applied code along with the cart. No `promotions` table, so
  only the one code exists; matches `03-cart.html`'s promo-code row that
  had never been built.
- Checkout (`components/customer/checkout-view.tsx`) reads `activeTable`
  from `useTables()` — if the customer arrived via a table's QR code, the
  dine-in badge shows the real table number and it's appended as
  `?table=` on the Order Tracking URL. Falls back to a fixed mock number
  only if Dine-in is picked manually without ever scanning a QR code.
  Total now subtracts both the cart's promo discount and the loyalty
  redemption discount together.
- Item "photos" are lucide-react icon placeholders in a colored box by
  default — `MenuItem.imageUrl` (optional) overrides this with a real
  `<img>` when set. No seed item ships with a photo (the Stitch exports'
  image URLs point at Google's internal AI-generation service and aren't
  stable to hardcode); real photos only exist for items an admin has
  uploaded through the new Add Item form — see "Product Detail Page" below.
- **Per-item order notes:** `CartItem.note` in `hooks/useCart.tsx`, entered
  on the Product Detail Page (e.g. "less sugar", "extra ice"). Note is part
  of `buildCartItemId`'s identity key, so adding the same drink twice with
  different notes creates two separate cart lines instead of merging and
  silently dropping one note. Shown in both Cart and Checkout's order
  summary as "Note: {text}". The quick "+" one-tap add on the Menu grid
  never sets a note (by design — it's the express lane for
  no-customization items, and skips the detail page entirely).
- **Back button:** `components/customer/header.tsx` (`CustomerHeader`)
  takes an optional `showBack` prop; when true it renders
  `components/customer/back-button.tsx` (client, `router.back()`) to the
  left of the brand mark. Only `(customer)/layout.tsx` passes `showBack` —
  `(marketing)` and `(auth)` layouts call `<CustomerHeader />` with no back
  button, since Landing/Login/Signup are entry points with nothing
  sensible to go back to. This also fixed a real dead-end: Checkout and
  Order Tracking hide `BottomNav` (Destination Rule) and, before this,
  had no navigation at all once you were on them.
## Product Detail Page (`/menu/[itemId]`)

Each drink/item now has its own real page, per the approved Stitch design
(project `4654820544595168289`, screen `bde2264a719d4f02b6086fa3d58d0c08`).
Tapping a Menu grid card (`components/customer/menu-browser.tsx`) navigates
here instead of the old inline expand-in-place panel — that panel is gone;
size/modifier selection, the note field, and Add to Cart all live on this
page now. The quick "+" one-tap add on the grid is unaffected (still adds
directly for items with no sizes/modifiers, bypassing this page).

- `components/customer/product-detail.tsx` (client) +
  `app/[locale]/(customer)/menu/[itemId]/page.tsx` (server component; looks
  up the item via `lib/supabase/menu-data.ts`'s `getMenuItemById`, calls
  Next's `notFound()` for an unknown id).
  Hides `BottomNav` (added to `bottom-nav.tsx`'s `isFocusedPage`) since it
  has its own sticky Add-to-Cart bar — safe now that every customer page
  has the header back button (see below), unlike when this Destination
  Rule pattern was first introduced.
- Rating/reviews are still mock, not real — the real `MenuItem` type
  (`lib/supabase/menu-data.ts`) has no `rating`/`reviewCount` columns to
  migrate; `MOCK_RATING`/`MOCK_REVIEW_COUNT` (`lib/mock-data/reviews.ts`,
  a fixed 4.5/75) drive this page's star summary, same shared value for
  every product rather than invented per-item precision. The actual
  review list is that same file's `MOCK_REVIEWS` — **one shared set of 3
  generic reviews reused across every product**, not per-item content, and
  deliberately read-only (no submit form) since a real review needs a
  customer identity that doesn't exist yet. `components/customer/star-rating.tsx`
  is the shared 5-star display, used on this page (the Menu grid itself
  doesn't show a rating).
- **Gotcha:** this project's shadcn `Button` wraps **Base UI**
  (`@base-ui/react/button`), not Radix — there is no `asChild` prop. For
  polymorphic rendering (e.g. a `Button` that navigates), use Base UI's
  `render` prop: `<Button render={<Link href="/x" />}>text</Button>`, not
  `<Button asChild><Link>...</Link></Button>`. Base UI's `Button` also
  defaults `nativeButton` to `true`, which expects the rendered element to
  literally be a `<button>` — since `Link` renders an `<a>`, always pass
  `nativeButton={false}` alongside `render={<Link .../>}` or it logs a dev
  warning about lost native button semantics.
- **Item extras are now admin-configurable** (2026-07-06,
  `docs/superpowers/specs/2026-07-06-menu-item-extras-design.md` +
  `docs/superpowers/plans/2026-07-06-menu-item-extras.md`). Each extra
  (e.g. "Extra Shot +10.000đ") is its own single-option `modifier_group`
  — no schema change — reused across items via the existing
  `menu_item_modifier_groups` join table, so admin defines it once
  (`components/admin/menu-item-form.tsx`'s new "Extras" section:
  checklist of existing extras + an inline "+ Add New Extra" form) and
  toggles it on for whichever items should offer it.
  `lib/supabase/menu-data.ts` gained `getModifierGroups`/
  `createModifierGroup`/`setItemModifierGroups` for this. Also fixed a
  real bug found while building this: a non-`required` modifier group
  with a single option (exactly what an extra is) could be selected on
  this page but never deselected — the click handler now really toggles
  for non-required groups, so a customer can pick any number of extras
  independently. Required groups (Size) are unaffected.

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
  (real menu items via `lib/supabase/menu-data.ts`, filtered to
  `isPopular`), and category chips that link to `/menu` (not pre-filtered
  — `menu-browser.tsx` has no query-param filtering).
- **Order History** (`components/customer/order-history.tsx`, no prior
  mockup): filter pills (All/Active/Completed — Active = preparing/ready,
  Completed = completed/cancelled), color-coded status badges, tapping a
  card navigates to `/orders/[id]`. Reads from the shared `useOrders()`
  hook (see "Customer ordering flow" above) — 5 seed orders plus whatever
  the customer actually places through Checkout. Becomes a real Supabase
  query (+ Realtime for active orders) once `orders` exists.
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
  Addresses/Settings rows (no addresses table, no customer settings page).
  The **Logout row is now real** (see below) — no longer disabled+tooltip.
  - **Auth-gate + role-nav shipped (2026-07-06)**: `/profile`, `/orders`,
    and `/loyalty` now hard-redirect a logged-out guest to `/login` —
    `middleware.ts` gates them via a new exact-path check (not prefix, so
    `/orders/[orderId]` — reached by guest checkout — stays reachable) in
    `lib/middleware-rules.ts` (the pure routing logic was extracted out of
    `middleware.ts` here so it's unit-testable without pulling in
    `next-intl/middleware` → `next/server`, which fails to resolve under
    Vitest in this environment). A logged-in Staff/Manager/Admin browsing
    the customer side now also gets a role-appropriate "Go to [X]"
    shortcut in two places: a small badge in `CustomerHeader` (all three
    customer-facing layouts) and a card on Profile between the avatar and
    editable fields, both linking to `ROLE_HOME[role]`. Role is resolved
    server-side per layout/page via the new `lib/get-current-role.ts`
    (`getCurrentRole(supabase)`, DI'd like `menu-data.ts`). `ProfileView`
    itself is still otherwise unchanged — `INITIAL_PROFILE`'s hardcoded
    mock name/phone/email remains a separate, still-open gap (not in this
    feature's scope). Design: `docs/superpowers/specs/2026-07-06-profile-auth-role-nav-design.md`.
    Plan: `docs/superpowers/plans/2026-07-06-profile-auth-role-nav.md`.
    Two throwaway test accounts (staff/customer roles) exist in the live
    Supabase project for verifying this — credentials in `.env.local`
    (`TEST_STAFF_EMAIL`/`TEST_STAFF_PASSWORD`, `TEST_CUSTOMER_EMAIL`/
    `TEST_CUSTOMER_PASSWORD`), created the same direct-SQL bootstrap way
    as the admin account (see "Database" below) since public signup hits
    the shared email rate limit.
- **Login / Signup** (`components/auth/login-form.tsx` +
  `signup-form.tsx`, ported from `06-login.html`/`07-signup.html`): **real
  Supabase Auth**, not mock — `supabase.auth.signInWithPassword` /
  `.signUp` via `lib/supabase/client.ts`'s browser client. Login looks up
  the signed-in user's `profiles.role` and redirects to `ROLE_HOME[role]`
  (`lib/roles.ts` — the single source of truth also imported by
  `middleware.ts`, so the role→home mapping can't drift between the two).
  Signup passes `full_name`/`phone` as Auth user metadata
  (`options.data`); if the project requires email confirmation (it does,
  by default, on this hosted project) `data.session` comes back null and
  the form shows a "check your email" screen instead of redirecting —
  only writes `profiles.full_name`/`phone` and redirects immediately in
  the rare case a session comes back right away (autoconfirm). Real error
  messages from Supabase now render inline instead of a disabled button.
  The Google buttons on both forms are still **disabled+tooltip** — no
  OAuth client configured. Shared Google "G" icon lives in
  `components/auth/google-icon.tsx` (used by both forms, avoids
  duplicating the inline SVG).
  - **Known gap:** this hosted Supabase project's shared email sender has
    a very low rate limit — confirmed by hitting
    `over_email_send_rate_limit` after a single real signup attempt during
    setup. Real customer signups will frequently fail to receive a
    confirmation email until a custom SMTP provider is configured in the
    Supabase dashboard (not something an MCP tool can set — no
    email/SMTP-config tool is exposed). Login is unaffected once an
    account is confirmed.
  - **Profile's Logout row** (`components/customer/profile-view.tsx`) is
    also now real: `supabase.auth.signOut()` then redirect to `/menu` as a
    guest (not `/login`) — guest ordering stays available, per the gap
    note a previous session had already left in place for this exact
    moment.
- New translation namespaces: `TableLanding` (from the earlier table-flow
  work), `OrderHistory`, `Loyalty`, `Profile`; expanded `Landing` and
  `Auth`. All added to both `messages/vi.json` and `messages/en.json`.

## Staff pages (`/staff/pos`, `/staff/orders`)

Real, interactive pages ported from `design/stitch-exports/10-staff-pos.html`
and `11-staff-kitchen-display.html`. `components/staff/staff-nav.tsx`
(brand name + POS/Kitchen Display links) is rendered by the POS page only
— Kitchen Display has its own full-fidelity shell instead (see below), so
`app/[locale]/staff/layout.tsx` no longer renders a nav itself; each staff
page is responsible for its own top-level chrome.

- **POS** (`components/staff/pos-terminal.tsx`) reuses the same real menu
  data as the customer app (`lib/supabase/menu-data.ts`). Tapping an item adds it at base
  price directly — there is no size/modifier picker here yet, unlike the
  customer Menu page; that's a known gap, not an oversight, tracked in
  continuity.md. Local component state only for the ticket itself (not
  `useCart` — POS is a separate staff-side transaction, not a shared
  persisted cart). Its table dropdown reads from the shared `useTables()`
  hook (selected by table `id`, not raw number — stays correct if the
  table is renamed elsewhere), and "Charge" pushes a real `KdsOrder` onto
  the shared Kitchen Display board via `useKitchenOrders()`'s `addOrder()`
  before clearing the ticket — POS and Kitchen Display are no longer
  disconnected mock-data islands.
- **`hooks/useKitchenOrders.tsx`** — Context+Provider (mounted in
  `app/[locale]/staff/layout.tsx`, shared by both `/staff/pos` and
  `/staff/orders`, same pattern as `useCart`/`useTables`) holding the
  `orders` array, `INITIAL_ORDERS` seed data, `NEXT_STATUS` map, and
  `addOrder`/`advance`. Deliberately **not** persisted to localStorage —
  matches POS/KDS's existing reset-on-reload behavior, just shared instead
  of duplicated per-page.
- **Kitchen Display** — split across several files under `components/staff/`,
  orchestrated by `kitchen-display.tsx`:
  - `kitchen-board.tsx` — the 3-column board (New/Preparing/Ready), a real
    ticking elapsed-time counter per order (`setInterval`), column header
    icons, per-status timer captions ("Elapsed Time"/"Preparing Time"),
    a "SIGNATURE ITEM" tag example, and Ready-column-specific styling
    (tinted card header, strikethrough items, "Done" instead of a timer).
    Types (`KdsOrder`/`KdsStatus`/`KdsOrderItem`) come from
    `useKitchenOrders.tsx`, not defined locally.
  - `kitchen-top-bar.tsx` — brand + a static "Barista Station 1" label +
    a "System Online" indicator + disabled+tooltip notification/settings
    icons (no notification system or staff settings page exist).
  - `kitchen-sidebar.tsx` — Terminal name/label (decorative, matches the
    Stitch mockup 1:1) + real "Live Orders"/"Order History" nav `Link`s
    (mutually exclusive active-highlight via `usePathname()`, see "Staff
    Order History" below) / disabled+tooltip "Inventory" (manager/admin-only,
    a staff-role user can't reach `/admin/inventory`) nav items + a **real**
    Shift Stats box: `completedCount` and average completion time are
    genuinely tracked in `kitchen-display.tsx`'s state as orders get
    completed this session (not a static mock number — starts at 0/`--:--`).
  - `kitchen-stats-footer.tsx` — **all real, computed from the current
    order list**, not mock: Current Load (Light/Moderate/Busy, thresholded
    on the count of non-ready orders) with a proportional bar, Queue (that
    same active-order count), Wait Time (average elapsed time across
    active orders, in minutes), and a live clock reusing the same ticking
    `now` state as the elapsed-time counters.
  - Advancing an order (`advance()`, now in `useKitchenOrders.tsx`) is
    shared state only for now — becomes a Realtime subscription + a real
    `UPDATE orders SET status=...` once the `orders` table exists (design
    spec Section 3d). The board/footer/sidebar don't need to change when
    that happens — they already just consume whatever `orders` array
    they're given. `kitchen-display.tsx` wraps `advance()` locally just to
    detect completions for its own Shift Stats display.
- Both routes are still gated by the existing `/staff/*` middleware rule
  (staff|manager|admin) — confirmed the gate itself wasn't broken by these
  changes, but couldn't verify the pages' own rendering against a real
  authenticated session (no live Supabase yet, and no browser automation
  tool in this environment) — same caveat as the Food Cost Calculator.

## Staff Order History (`/staff/orders/history`, `/staff/orders/history/[orderId]`)

Real, reachable from the Kitchen Display sidebar's now-real "Order
History" link (previously disabled+tooltip). Design:
`docs/superpowers/specs/2026-07-07-staff-order-history-design.md`. Plan:
`docs/superpowers/plans/2026-07-07-staff-order-history.md`. A different
surface from the customer-facing Order History (`hooks/useOrders.tsx`'s
`getMyOrders()`, one customer's own orders) — this one is staff-wide
lookup across every order, primarily for "a customer asks about their
order" rather than a live board (that's what the Kitchen Display board
already covers for active orders).

- **`get_order_history()`** (migration `0019`, `security invoker` — RLS
  already grants staff/manager/admin full read on
  `orders`/`tables`/`profiles`, no bypass needed) does search/filter/
  pagination in one round trip: matches a single search box against the
  short order-id prefix (`formatOrderId`'s first-8-hex-chars convention),
  table number, or customer name/phone; defaults to the last 7 days and
  `completed`/`cancelled` statuses when not otherwise filtered, enforced
  **inside** the function so a client bug can't pull active orders or the
  whole table's history. **Real bug found only by live Playwright
  verification, not direct SQL**: a Postgres function parameter's
  `default` only applies when the argument is *omitted*, not when
  explicitly sent as JSON `null` — which PostgREST's RPC call always
  does. `p_statuses` was binding to real `null`, making
  `status = any(null)` match zero rows regardless of how many
  completed/cancelled orders actually existed (confirmed: a direct SQL
  call showed 12 matching rows while the browser's identical-looking RPC
  call returned an empty array). Fixed by `coalesce`-ing `p_statuses` to
  its intended default inside the function body instead of relying on
  the parameter's own `default` clause.
- `lib/supabase/orders-data.ts` gained `getOrderHistory`/
  `getOrderHistoryDetail` — the detail query is a plain RLS-gated select
  (not a reuse of the customer-facing `get_order_for_tracking` RPC, which
  *does* already have a staff/manager/admin bypass clause — an initial
  partial read during this feature's design had wrongly concluded
  otherwise — but its returned shape has no `payment_method`/
  `payment_status`/customer fields, which this page needs).
- `hooks/useOrderHistory.tsx` — a **plain hook, not a Context/Provider**
  (unlike `useKitchenOrders`/`useInventory`/`useTables`) since nothing
  else in the app shares this data. Subscribes unfiltered to `orders`
  `postgres_changes` and refetches the current page on any change, same
  "a column filter doesn't reliably combine with RLS-gated
  `postgres_changes`" pattern every other Realtime hook here already
  uses.
- `components/staff/order-history-list.tsx` — debounced (~300ms) search,
  date range (default last 7 days), status/order-type filters, a
  paginated table, and an empty state distinct from the loading state.
  Any filter change resets to page 1.
- `components/staff/order-history-detail.tsx` — items with notes,
  subtotal/discount/total, payment method/status, customer name (or
  "Guest" for a guest checkout order). The detail page route calls
  Next's `notFound()` for an unknown/inaccessible order id, same pattern
  as the Product Detail Page.
- New `StaffOrderHistory` translation namespace (kept separate from the
  customer-facing `OrderHistory` namespace, since labels genuinely
  differ) in both `messages/vi.json`/`messages/en.json`.

## Real orders + Realtime (2026-07-06, core, Cash-only)

Third "make all data real-time" sub-project — unifies what used to be
two disconnected mock systems (`hooks/useOrders.tsx` for customer
Checkout/Tracking/History, `hooks/useKitchenOrders.tsx` for staff
POS/Kitchen Display) into one real `orders` schema (migrations
`0005`-`0007`, already applied) with live Realtime. Design:
`docs/superpowers/specs/2026-07-06-orders-realtime-design.md`. Plan:
`docs/superpowers/plans/2026-07-06-orders-realtime.md`. Stripe/VNPay were
explicitly out of scope for this sub-project (separate future specs) —
both are now real, see "Stripe payment integration" and "VNPay payment
integration" below.

- **`place_order`** (migration `0014`, `security definer`) — the one
  place order money values are computed. Takes a JSON cart payload,
  looks up real prices from `menu_items`/`menu_item_sizes`/`modifiers`
  server-side (never trusts a client-supplied price), recomputes the
  promo-code discount and validates any redeemed loyalty points against
  the real balance, and inserts `orders`+`order_items`+
  `order_item_modifiers` atomically. Always inserts at
  `payment_status='pending'`, then a genuine second `update` to `'paid'`
  when payment was already collected (POS) — required because
  `handle_order_paid` (migration `0007`) is a `before update` trigger
  and cannot fire on `insert`. `order_items` gained a `note` column in
  this same migration — the real schema had nowhere to store a
  customer's free-text per-item note until this was caught while
  designing the function.
- **`get_order_for_tracking`** (`security definer`) — the only way a
  guest (or anyone) reads a single order for tracking. Deliberately
  *not* a broad RLS SELECT policy: a `customer_id is null` policy would
  let any guest bulk-read every other guest's order, since RLS gates by
  row predicate, not by "did you ask for this specific id." A
  single-row lookup function with the id as a required parameter closes
  that hole while still letting a guest see their own order.
- **`place-order` Edge Function** — real now (was a comment-only stub),
  a thin wrapper calling `place_order` with the service-role key so the
  RPC's own internal authorization is the real boundary. Two real bugs
  found only by testing through an actual browser (not curl, which
  skips both of these): (1) no CORS handling at all — the browser's
  preflight `OPTIONS` request was flatly rejected; (2)
  `supabase.functions.invoke()` always attaches *some* `Authorization`
  header, even for a guest — for a guest it's the client's own
  publishable key (`sb_publishable_...`), not a JWT, and forwarding that
  blindly broke `auth.uid()` resolution ("Expected 3 parts in JWT; got
  1"). Fixed by only forwarding the header when it's actually
  JWT-shaped. `verify_jwt` is disabled on this function (a guest has no
  JWT at all to verify).
- **Realtime — two real bugs found only by testing through the actual
  UI, not direct SQL/RPC calls:**
  1. Migration `0014` added the RPCs but never added `orders` to the
     `supabase_realtime` publication (unlike Inventory's/Tables'
     migrations, which each did this themselves) — neither customer
     tracking nor Kitchen Display received any live update at all until
     migration `0015` fixed it.
  2. `order-tracking.tsx`'s single-order subscription used a
     `filter: 'id=eq.X'` clause, which does not reliably combine with
     RLS-gated `postgres_changes` — confirmed directly with `supabase-js`
     that an identical subscription with no filter received events
     correctly while the filtered one received nothing. Fixed by
     subscribing with no filter and checking the delivered payload's id
     client-side (the same no-filter-then-refetch shape
     `useOrders.tsx`/`useKitchenOrders.tsx` already used successfully).
  3. A **known, deliberate gap, not a bug**: a guest's own tracking page
     has no Realtime path at all (RLS would have to allow bulk guest
     visibility to make it work, which is exactly the leak
     `get_order_for_tracking` avoids) — it polls `get_order_for_tracking`
     every 10 seconds instead, clearly labeled in the UI as polling.
     Logged-in customers and staff get true Realtime.
- **Cash's two real payment-collection moments**: self-checkout Cash
  ("pay at pickup") starts at `pending_payment`/`pending` — staff
  confirms cash received later via a new **Awaiting Payment** list,
  present on both `components/staff/kitchen-pending-payment.tsx`
  (shared by Kitchen Display and POS) with a "Confirm Cash Received"
  action (`confirmCashPayment` — a plain `update`, no RPC needed, since
  staff already satisfies `orders_update_staff`). POS-charged Cash is
  collected in person immediately, so `place_order`'s
  `paymentCollected: true` flag skips straight to `paid` — no Awaiting
  Payment step for a POS sale.
- Kitchen Display's board now maps the real 6-state `order_status` enum:
  `pending_payment` (Awaiting Payment list) → `paid` ("New" column) →
  `preparing` → `ready` → `completed` (a real status update now, not
  just deleting the order from local state) → `cancelled`. The
  decorative mock `noteVi`/`noteEn`/`isSignature` fields (no real
  backing ever existed for them) are gone — real `order_items.note` is
  a single free-text string, not a bilingual pair.
- Order Tracking's old `FALLBACK_ORDER` mock (shown for any id not in
  the local store) is gone — an unknown/inaccessible id now shows a real
  "Order Not Found" state instead of fabricated data.
- `supabase/functions/place-order` writing real code (previously a
  single comment line) surfaced that the root `tsconfig.json` had been
  silently type-checking Deno Edge Function files with the main Next.js
  project's compiler options — fixed by excluding `supabase/functions`
  from the main tsconfig (Edge Functions are a separate Deno runtime).

## Stripe payment integration (2026-07-07, core)

Follow-up to Real Orders + Realtime, per the sequencing agreed there
(Cash → Stripe → VNPay). Design:
`docs/superpowers/specs/2026-07-07-stripe-payment-integration-design.md`.
Plan: `docs/superpowers/plans/2026-07-07-stripe-payment-integration.md`.
Checkout's Card button and POS's Card button are both real now; VNPay
remains its own separate, still-pending follow-up.

- **A real pre-existing bug found and fixed first**: `checkout-view.tsx`
  and `pos-terminal.tsx` both sent the client's hyphenated `"dine-in"`
  state straight to `place_order`, which casts it directly to the
  `order_type` enum (`pickup | dine_in`, underscore) — confirmed live
  that `'dine-in'::order_type` throws. **Every dine-in order placed via
  Checkout or POS was failing**, regardless of payment method, until
  this fix (both now translate to `dine_in` before the RPC call).
- **`place-order` Edge Function (extended, not replaced)** — after
  `place_order` inserts the order as before, if `paymentMethod ===
  "stripe"` and `paymentCollected` isn't already `true` (the customer
  online-checkout case, not POS), it also creates a real Stripe Checkout
  Session via raw `fetch` against Stripe's REST API (form-urlencoded, no
  Stripe SDK — matches this project's dependency-free Edge Functions).
  **VND is a Stripe zero-decimal currency** — the integer total is sent
  as-is, never multiplied by 100. Session `expires_at` is set to 30
  minutes (Stripe's minimum), not the 24h default, so an abandoned
  checkout doesn't leave a `pending_payment` row around for a full day.
  `success_url`/`cancel_url` are built **server-side** from a `SITE_URL`
  Supabase secret + a client-supplied `locale` (validated against
  `vi`/`en`) — never a raw client-supplied URL, which would be an
  open-redirect vector on a payment flow. Returns `{ orderId, total,
  checkoutUrl }` when a session was created.
- **`stripe-webhook` Edge Function (real now, was a stub)** — verifies
  Stripe's signature manually via Web Crypto (HMAC-SHA256), not the
  Stripe SDK. `checkout.session.completed` flips the matching order (by
  `metadata.order_id`) to `status='paid', payment_status='paid'` via a
  plain service-role `UPDATE` guarded by `payment_status = 'pending'`;
  `checkout.session.expired` flips it to `cancelled` under the same
  guard. Both guards, plus `handle_order_paid`'s own `old is distinct
  from 'paid'` check, make Stripe's automatic webhook retries a safe
  no-op rather than a double inventory deduction or double loyalty
  award. `verify_jwt` disabled — Stripe's signature is the real trust
  boundary, there's no Supabase session on this request at all.
- **`cancel_pending_order(p_order_id uuid)`** (migration `0018`,
  `security definer`) — lets a customer self-cancel their own
  still-pending order (backing out of Stripe's hosted page) without
  waiting for the 30-minute expiry webhook. Mirrors
  `get_order_for_tracking`'s guest-safe pattern: only affects a row
  still `pending_payment`; a logged-in customer must own it, a guest
  order (`customer_id is null`) can be cancelled by anyone holding that
  exact unguessable UUID (same trust model already established for
  guest tracking). `lib/supabase/orders-data.ts`'s `cancelPendingOrder()`
  is the query-layer wrapper, called directly from `checkout-view.tsx`
  (not through an Edge Function — same pattern `useOrders.tsx` already
  uses for guest-safe RPCs).
- **Checkout flow**: cart is **not** cleared when a `checkoutUrl` comes
  back — only Cash clears immediately, since Stripe's redirect to
  `success_url` (`/orders/{orderId}`, reusing the existing Order
  Tracking route) is the real confirmation point. Backing out of
  Stripe's page redirects to `cancel_url`
  (`/checkout?stripeCanceled={orderId}`), which `checkout-view.tsx`
  detects on mount, calls `cancelPendingOrder`, shows a "payment
  cancelled" notice, and leaves the cart intact for a retry.
- **POS's Card option** reuses the `payment_method = 'stripe'` enum
  value to mean "card" — there's no separate `'card'` enum value, same
  overloading `'cash'` already has for both online pay-at-pickup and
  in-person POS cash. POS sends `paymentCollected: true`, so
  `place-order` skips the Stripe branch entirely and marks the order
  paid immediately — money was already collected via a physical card
  terminal outside this app; no Stripe Terminal integration exists
  (that would be its own future project).
- **A real webhook misconfiguration found during live verification, not
  a code bug**: the Stripe Dashboard webhook endpoint was initially
  pointed at the Vercel frontend URL instead of the Supabase Edge
  Function URL (`https://qhiypdqnrnzndxdwqxbx.supabase.co/functions/v1/stripe-webhook`),
  so zero deliveries ever reached `stripe-webhook` — confirmed via Edge
  Function logs showing no invocations at all in the window after a
  real payment. After correcting the URL, deliveries arrived but still
  failed — `STRIPE_WEBHOOK_SECRET` had never actually been set as a
  **Supabase Edge Function secret** (a separate store from Vercel's env
  vars/`.env.local` — this is the second time this exact gotcha has
  bitten this project, see `SITE_URL`/`STRIPE_SECRET_KEY` above). Root
  cause was confirmed (not guessed) by temporarily having the function
  return non-sensitive diagnostic booleans (`hasSignatureHeader`,
  `hasWebhookSecret`) in its response body — reverted once confirmed.
  Verified live end-to-end afterward: a real Stripe test payment →
  webhook fires → order flips to `paid` → loyalty points awarded
  correctly (checked directly via `loyalty_points_earned`) — the ordered
  item happened to have zero recipe ingredients configured, so no
  inventory deduction was expected or seen, not a bug.
- **Explicitly out of scope**: refunds/disputes (handled manually via
  the Stripe Dashboard), Stripe Terminal for a real in-person
  Stripe-processed card reader, VNPay (separate future spec).

## VNPay payment integration (2026-07-07, core)

Last item in the Cash → Stripe → VNPay payment sequencing agreed in the
Orders Realtime spec — closes out the whole "make all data real-time"
payments follow-up work. Design:
`docs/superpowers/specs/2026-07-07-vnpay-payment-integration-design.md`.
Plan: `docs/superpowers/plans/2026-07-07-vnpay-payment-integration.md`.
Checkout's VNPay button and POS's VNPay button are both real now.

- **`place-order` Edge Function (extended again)**: a VNPay branch
  alongside the existing Stripe one — `paymentMethod === "vnpay"` and
  not already collected builds a signed VNPay Checkout URL locally (no
  API call needed, unlike Stripe's Checkout Session). VNPay's amount
  convention is the *opposite* of Stripe's zero-decimal VND handling:
  always `total × 100`. `vnp_ReturnUrl` points at this project's own
  Supabase function URL (`SUPABASE_URL`, auto-provided), not `SITE_URL`
  (the Vercel domain Stripe's success/cancel URLs use) — `vnpay-return`
  does its own server-side redirect onward after verifying VNPay's hash.
- **`vnpay-ipn` Edge Function (new — was a stub)**: server-to-server,
  the sole source of truth for "paid," mirroring `stripe-webhook`'s
  role — not `vnpay-return`, since a browser redirect isn't guaranteed
  to fire if the tab closes. Verifies VNPay's hash, cross-checks
  `vnp_Amount` against the order's real stored total (never trusts
  VNPay's echoed amount), and returns VNPay's specific `{RspCode,
  Message}` JSON contract (`"00"` paid, `"02"` already-confirmed/
  idempotent-retry, `"04"` amount mismatch, `"97"` bad signature, `"01"`
  order not found) rather than a bare 200.
- **`vnpay-return` Edge Function (new — was a stub)**: unlike Stripe's
  separate `success_url`/`cancel_url`, VNPay redirects to **one** return
  URL for every outcome, distinguished by `vnp_ResponseCode`. Verifies
  the same hash; on success redirects to `/orders/{orderId}`, on
  failure/cancel calls the existing guest-safe `cancel_pending_order`
  RPC (reused as-is from the Stripe work, migration `0018`) then
  redirects to `/checkout?paymentFailed=1` — no client-side self-cancel
  dance needed here since the cancellation already happened server-side
  before the browser lands.
- **POS's VNPay option** sends `paymentCollected: true`, skipping the
  VNPay branch entirely and marking the order paid immediately — same
  "already collected in person, no gateway API call" pattern as POS's
  Card option, except VNPay has its own real enum value (`'vnpay'`)
  rather than reusing another payment method's.
- **A real signing bug found via live sandbox testing, not guessed**:
  the first live VNPay checkout attempt showed "Invalid signature" on
  VNPay's *own* payment page — before the customer could even enter
  card details, meaning the bug was in the *outgoing* signed URL, not
  IPN/return. Root-caused by fetching and comparing against a
  known-working reference implementation
  (`github.com/Gnoltd/MysteryBoxFreshFood`): VNPay signs using **PHP
  `urlencode()` convention**, where a space encodes as `+`, not `%20`
  like plain `encodeURIComponent`. Since `vnp_OrderInfo` contains
  spaces, the wrong encoding produced a hash VNPay's servers could never
  match. Fixed with a shared `vnpayEncode()` helper
  (`encodeURIComponent(v).replace(/%20/g, "+")`) applied consistently in
  all three places that sign or verify VNPay data — `place-order`
  (outgoing), `vnpay-ipn` and `vnpay-return` (incoming; a receiving
  Deno function's `URLSearchParams` correctly decodes `+` back to a
  literal space per the WHATWG form-urlencoded spec, but re-encoding
  that decoded value for verification needs the same `+`-for-space fix
  or the two sides diverge again). Verified live afterward: a real
  VNPay sandbox transaction (customer-cancelled, `vnp_ResponseCode=24`)
  produced a signature `vnpay-ipn` correctly verified and processed
  (returned `RspCode "00"`/confirmed, order correctly marked
  `cancelled`) — direct proof the fix works end-to-end for real VNPay
  traffic, though a full *successful* (paid) sandbox transaction hadn't
  been separately confirmed as of this writing (architecturally
  identical code path, just `vnp_ResponseCode === "00"` instead — same
  confidence level, just not yet directly observed with a `paid` row).
- **Explicitly out of scope**: refunds/disputes (VNPay merchant portal,
  manual), any VNPay payment method beyond the standard redirect gateway
  (e.g. pre-selecting a bank code to skip VNPay's method-selection page).

## Admin pages (`/admin/dashboard`, `/menu`, `/inventory`, `/tables`, `/staff`, `/settings`)

Real, interactive pages ported from `design/stitch-exports/12-admin-dashboard.html`
through `17-admin-settings.html`. All admin routes (including the
pre-existing Food Cost Calculator) now share one left-sidebar shell:
`components/admin/admin-sidebar.tsx` + `app/[locale]/admin/layout.tsx`
(replaced the old plain top-nav). Dropped the mockups' fake admin-profile
header for the same reason as staff — no real auth data yet.

- `components/admin/{dashboard-view,menu-management,inventory-management,tables-management,staff-accounts,settings-view}.tsx`
  — one component per page. Menu Management reads/writes real menu data via
  `lib/supabase/menu-data.ts` (`getMenuItems`/`createMenuItem`/
  `updateMenuItem`/`deleteMenuItem`); Dashboard/Inventory share
  `hooks/useInventory.tsx`; Tables shares
  `hooks/useTables.tsx`; Staff and Settings hold their own local mocks
  since nothing else needs that data. `menu-item-form.tsx` and
  `staff-member-form.tsx` are separate Add/Edit modal components used by
  Menu Management and Staff Accounts respectively.
- **Convention for not-yet-backed actions:** an "Add X" button is rendered
  `disabled` with an explanatory `title` tooltip only when there's
  genuinely no real table to persist to. **Menu's "Add/Edit Item", Staff's
  "Add/Edit Staff", and now Tables' "Add New Table" are all real** (see
  `hooks/useTables.tsx`'s `addTable()`) — adding to that page's own local
  array needs no real backend table, so per the "fully build the frontend
  now, wire up BE later" direction, they're implemented like any other
  local-state action. No remaining example of this convention exists in
  the admin section as of this writing — everything with local state to
  add to has a real Add action.
- **Shared state across pages, not disconnected mock copies:** a full
  audit of every admin page against its Stitch mockup (user-requested)
  found several pages holding their own separate copy of data that other
  pages also needed — same class of bug as the earlier POS/Kitchen Display
  fix. Fixed the same way, with new Context+Provider hooks:
  - **`hooks/useInventory.tsx`** (mounted in `app/[locale]/admin/layout.tsx`,
    shared by Dashboard and Inventory): `ingredients` + a real `logs` array
    that every stock change appends to (with a real signed `change` and a
    `reason: "restock" | "adjustment" | "waste" | "order_deduction"`, not a
    hardcoded label). Dashboard keeps its quick one-tap `restock()` (tops
    up by the low-stock threshold — no modal, matches a dashboard's
    "glance and go" role). Inventory's own page uses the more general
    `adjustStock(id, change, reason)` and `setOutOfStock(id)` via
    `components/admin/stock-adjust-form.tsx` — a real modal where an admin
    types an amount to add or remove (stock is clamped at 0, never
    negative) or force-sets an ingredient to Out of Stock regardless of
    its current quantity. Status is now three-state (In Stock / Low Stock
    / Out of Stock — `stock <= 0` takes priority over the threshold
    comparison), not the old two-state derived badge. Dashboard's
    low-stock widget and Restock button still read/write this same shared
    state — restocking from the Dashboard still removes the item from
    Inventory's low-stock table too.
    - **Now real Supabase data with Realtime (2026-07-06), not
      `localStorage`.** Design: `docs/superpowers/specs/2026-07-06-inventory-realtime-design.md`.
      Plan: `docs/superpowers/plans/2026-07-06-inventory-realtime.md`.
      `ingredients`/`inventory_logs` (migration `0004_inventory.sql`) were
      already applied with RLS — the actual gap was bilingual columns
      (`name_vi`/`name_en`/`subtitle_vi`/`subtitle_en`/`icon`, added by
      migration `0010_inventory_i18n_and_stock_fn.sql`) and an admin UI,
      which didn't exist at all. `lib/supabase/inventory-data.ts` is the
      query layer (DI'd like `menu-data.ts`). Stock changes go through a
      new Postgres RPC, `adjust_ingredient_stock` — a `security invoker`
      function that locks the row, clamps the change so stock can't go
      negative, updates it, and inserts the matching log row in one
      atomic round trip (replaces the old mock's client-side
      clamp-then-write, which was only ever safe with a single browser
      tab). `hooks/useInventory.tsx` fetches once on mount and subscribes
      to `postgres_changes` on both tables (added to the
      `supabase_realtime` publication) — any admin's stock change,
      rename, or new ingredient appears live on every other open
      admin session within about a second, with no manual refresh and no
      separate optimistic-update path (mutation functions never call
      `setIngredients` themselves; the Realtime echo is the only code
      path that updates local state, including for the tab that made the
      change). Inventory gained a real **"+ Add Ingredient"** button and a
      per-row edit pencil (`components/admin/ingredient-form.tsx`) — ingredients
      are no longer a fixed set of 4; migration `0011_seed_inventory_data.sql`
      seeded the original 4 mock values as real rows so nothing visually
      changed on launch day.
    - **Recipes are now real too, and admin-configurable.** The DB already
      had `menu_item_ingredients`/`modifier_ingredients` (how much of an
      ingredient a menu item or a modifier/extra consumes — feeding the
      already-existing but previously-dead `handle_order_paid` deduction
      trigger from migration `0007`) but zero rows and zero UI. Menu's
      Add/Edit Item form gained a "Recipe" section (checklist + quantity
      input per ingredient, shared `components/admin/recipe-checklist.tsx`
      component) for the base item's own recipe. Extras — shipped
      previous session with **create-only** UI — gained their first
      **edit** affordance (a pencil per extra, opening an inline panel)
      so an existing extra's name/price *and* its own ingredient usage can
      be changed after creation; this needed a new `updateModifierGroup`
      in `menu-data.ts`. These recipe rows have no functional effect yet
      (the deduction trigger only fires once real order placement exists
      — sub-project #3, "Orders," still pending) but are now real,
      admin-authored data ready for that trigger to consume the moment
      it does.
  - **`hooks/useTables.tsx`** gained `isOccupied` (admin-toggleable),
    `scanCount` (genuinely incremented in `setActiveTableByToken` every
    time `/table/[qrToken]` resolves a real table — not a fake "today"
    counter), and `locationVi`/`locationEn` (editable alongside the table
    number, same inline edit UI).
- Actions that only need **local** state (no persistence) are implemented
  for real, not stubbed:
  - Menu's availability toggle + delete + **Add/Edit Item**
    (`components/admin/menu-item-form.tsx` — one form handles both;
    `MenuManagement` passes `initialItem` when editing, omitted when
    adding. Has a working drag-and-drop/browse-from-computer image picker
    using `URL.createObjectURL`. **Gotcha:** when editing, the form must
    not `revokeObjectURL` an inherited `initialItem.imageUrl` on
    close/cleanup — that blob URL may still be live in the table row, Menu
    grid, and Product Detail Page simultaneously; only URLs *this form
    instance* created via `selectFile` get revoked, tracked by an
    `ownsPreviewUrl` flag), a real Category badge column, and client-side
    pagination (5/page).
  - Inventory's stock adjustment (see shared hook above) plus a real
    **Logs tab** (`components/admin/inventory-management.tsx`) showing
    genuine stock-change history with correct sign and reason — not mock
    rows, built from the same `logs` array.
  - Tables' rename, location edit, occupied/available toggle, QR token
    regeneration, and **Add New Table** (all via the shared `useTables()`
    hook — see "Table identity flow" below) plus a real stat row
    (Total/Available/Occupied/Scans, all computed, none hardcoded). Each
    table card renders a **real, scannable QR code** (the `qrcode` npm
    package, generated client-side as a PNG data URL encoding
    `{origin}/table/{qrToken}` — no external QR-generation service, no
    network call) in place of the old generic `QrCode` lucide icon
    placeholder, and **Download QR** is real (triggers a browser download
    of that PNG), not disabled+tooltip.
  - Staff's activate/deactivate toggle + **Add/Edit Staff**
    (`components/admin/staff-member-form.tsx`, same pattern as the Menu
    form) + pagination + real Total/Active/Disabled stat cards.
  - Settings' Loyalty program now has a real enable/disable toggle
    (disables the rate inputs when off) and a working **Cancel** button
    that reverts unsaved edits to the last-saved snapshot — previously
    there was no way to discard a draft edit. Save still shows a real
    confirmation but doesn't persist.
- Dashboard's revenue/orders/loyalty KPI numbers and the 7-day chart
  remain fixed mock data (no `orders` table to aggregate yet) — but its
  low-stock widget is real (see shared inventory hook above), and "View
  All Items" under Best Sellers is a real link to `/admin/menu`.
- **Deliberately not built:** trend badges (+12.4%, +8%, "Stable"),
  "1,284 loyalty members," "New hires," and similar mockup numbers that
  have no real signal to compute from yet — inventing plausible-looking
  fake analytics would contradict the mock-vs-real honesty convention this
  whole app follows. These become real once Supabase's `orders` and
  `loyalty_transactions` tables exist.
- All six routes remain behind the existing `/admin/*` middleware rule
  (manager|admin, with `/admin/staff` and `/admin/settings` admin-only) —
  confirmed the gate still works for every route (including Food Cost)
  after the layout change. Later verified rendering directly against a
  real authenticated session using Playwright (installed ad hoc via
  `npm install playwright` — not a project dependency, no `chromium-cli`
  available in this environment) once real Supabase Auth existed; no
  browser automation tool was available before that.
- **Gotcha — toggle-switch thumb needs an explicit `left` position.**
  Every hand-rolled `role="switch"` toggle in this codebase (Menu's
  availability toggle, Settings' loyalty toggle, Checkout's redeem-points
  toggle, and both Add/Edit form's availability/active toggles) had the
  thumb `<span>` positioned with only `top-0.5` and no `left`/`inset-x`
  class. Without an explicit `left`, the browser resolves the thumb's
  static position to `left: 22px; right: 2px` inside the 44px track (not
  flush-left as the `translate-x-0.5` / `translate-x-[22px]` values
  assumed), so the "on" state's translate pushed the thumb completely
  outside the track. Fixed everywhere by anchoring explicitly —
  `absolute left-0.5 top-0.5` base position, `translate-x-0` (off) /
  `translate-x-5` (on) — instead of relying on the browser's static-
  position fallback. If a new toggle switch is added anywhere, copy this
  fixed version, not the old pattern (check `git log` before this note's
  commit for the broken version if it resurfaces from a merge).
- **Gotcha — the fixed top-right `LanguageSwitcher` can overlap admin
  page header buttons.** It's `fixed top-2 right-2 z-50`
  (`app/[locale]/layout.tsx`), positioned relative to the viewport, not
  page content. Admin pages with a right-aligned header action button
  (Menu's Add Item, Staff's Add Staff, Tables' Add New Table) render close
  enough to the viewport's top-right corner at common desktop widths that
  the switcher visually sat on top of — and intercepted clicks on — part
  of the button. Fixed by giving `app/[locale]/admin/layout.tsx`'s `main`
  extra top padding (`pt-16` instead of `p-6`'s uniform `p-6`) so admin
  page content never renders in the vertical band the switcher occupies.
  Staff pages (`/staff/pos`, `/staff/orders`) have their own full-fidelity
  top bars and weren't audited for the same issue — worth checking if a
  similar report comes in for those.

## Table identity flow (`/table/[qrToken]` → Checkout → Order Tracking)

Connects an admin-renamed table's identity all the way through to a
customer's order. **Now real Supabase data with Realtime (2026-07-06)**
for the table directory, not `localStorage` mock rows. Design:
`docs/superpowers/specs/2026-07-06-tables-realtime-design.md`. Plan:
`docs/superpowers/plans/2026-07-06-tables-realtime.md`.

- `public.tables` (migration `0005_orders.sql`) was already applied with
  RLS (`tables_select_all` — public read, since a QR-scanning guest has
  no role; `tables_admin_all` — manager/admin-only writes) and already
  wired as `orders.table_id`'s FK target. Migrations
  `0012_tables_i18n_and_scan_fn`/`0013_seed_tables_data` added
  `location_vi`/`location_en`/`is_occupied`/`scan_count` columns and
  seeded the 6 original mock tables as real rows.
- `lib/supabase/tables-data.ts` — query layer (DI'd like `menu-data.ts`/
  `inventory-data.ts`). Two RPCs back the two operations that plain
  RLS-gated updates can't safely express: `regenerate_table_qr_token`
  (`security invoker`, admin-only, generates a fresh
  `encode(gen_random_bytes(16),'hex')` server-side) and
  **`increment_table_scan_count`** (`security definer` — the one
  function in this project that needs it, since an anonymous QR-scanning
  guest has no role and would otherwise be blocked by
  `tables_admin_all`; scoped to only ever touch `scan_count`, so it
  can't be used to rename/relocate/re-token a table as a privilege-
  escalation path). Verified live with a fresh, logged-out browser
  context: scanning a real token resolves the table and increments
  `scan_count` with no authentication at all.
- `hooks/useTables.tsx` — the **table list** (`tables`) fetches once and
  subscribes to `postgres_changes`, same pattern as `useInventory.tsx`:
  an admin's rename/location-edit/occupied-toggle/QR-regen appears live
  on every other open admin session within about a second. **`activeTable`
  (a single browser tab's "which table am I ordering at" session)
  deliberately keeps its existing `localStorage` persistence, unchanged**
  — it must survive a VI/EN locale switch (which remounts every provider
  under `app/[locale]/layout.tsx`, the same bug class that hit
  `useInventory.tsx` two sessions ago); dropping it would silently
  regress a customer's dine-in context on a language switch. Verified
  directly: `localStorage`'s `phadincoffee-active-table` value survives
  a full page reload with all fields intact.
- `components/customer/table-landing.tsx` — `setActiveTableByToken` is
  now `async` (a real query, not a local array `.find`); the component's
  loading/invalid/success states are otherwise unchanged.
- Admin Tables gained a real **"+ Add Table"** modal
  (`components/admin/table-form.tsx`) — a real `table_number unique`
  constraint means admin must supply a number, and a collision (on add
  *or* rename) now surfaces a real inline error instead of a mock
  auto-increment that could never collide.
- **Previously documented gap resolved, no code needed:** "QR token
  regeneration doesn't invalidate an already-active session" was only
  ever true because everything was one shared local array. With a real
  backend, `activeTable` is a value resolved once at scan time and held
  in that tab's memory — an admin regenerating the token afterward
  doesn't (and shouldn't) retroactively change what a customer already
  has, mirroring a real reprinted QR sticker not affecting someone
  already seated. This is working as intended, not a remaining gap.
- **New gap found, out of scope for this plan:** `components/customer/checkout-view.tsx`'s
  `const [orderType, setOrderType] = useState(activeTable ? "dine-in" : "pickup")`
  reads `activeTable` only once, at first render — if `activeTable` is
  still `null` at that exact instant (e.g. right after a full page
  reload, before `TablesProvider`'s `localStorage` hydration effect has
  run), Checkout defaults to "pickup" even though `activeTable` becomes
  correctly populated moments later. Confirmed via Playwright: this
  predates the Tables Realtime work (the old mock hook had the identical
  hydrate-in-effect timing) and isn't something this plan's scope
  touched — worth a small follow-up fix (e.g. re-deriving `orderType`
  reactively, or gating Checkout's initial render on `TablesProvider`
  finishing hydration) whenever Checkout itself is revisited.

## Staff accounts + Realtime (2026-07-06, core)

Fourth and final sub-project of the "make all data real-time" initiative
— replaces Admin Staff's local mock array with real Supabase Auth
accounts + a real `profiles` directory + Realtime. Design:
`docs/superpowers/specs/2026-07-06-staff-accounts-realtime-design.md`.
Plan: `docs/superpowers/plans/2026-07-06-staff-accounts-realtime.md`.

- **`is_active` disable mechanism, not Auth banning.** Migration `0016`
  adds `profiles.is_active` (default `true`) and changes
  `current_user_role()` to `select case when is_active then role else
  'customer' end ...` — disabling a staff/manager/admin account doesn't
  touch their Supabase Auth login at all; it just makes every RLS check
  and role-gated read resolve them as a plain `customer` while
  `is_active = false`. Chosen over actually banning/locking the Auth
  account because a real disabled employee still walks in and orders
  coffee as a customer — there's no separate logout/ban step, and
  no stale-session risk, since role is never cached client-side and is
  re-resolved on every request.
- **`get_staff_members()`** (migration `0016`, `security definer`) — the
  only controlled read path for a staff directory. `auth.users` is a
  protected schema with no client-facing email column on `profiles`, so
  this function joins the two server-side and returns `id`/`full_name`/
  `phone`/`role`/`is_active`/`email`, gated to callers whose own
  `current_user_role()` is staff/manager/admin.
- **`create-staff-account` Edge Function** — creates a real,
  login-capable Supabase Auth account for a new hire (`profiles` rows
  can only ever be created via the `handle_new_user` trigger on
  `auth.users` insert, so this can't be a plain table insert). Uses
  `auth.admin.createUser({ email_confirm: true, ... })` to skip sending
  any confirmation email at all — deliberately sidesteps this project's
  already-documented shared-email-sender rate limit rather than hitting
  it again — and returns a randomly generated one-time password for the
  admin to relay to the new hire out of band (shown once in Admin
  Staff's UI via a copyable panel, never emailed, never stored).
  `verify_jwt` stays enabled (the default) here, unlike `place-order` —
  there's no guest use case, only an already-authenticated admin ever
  calls it.
- **Real bug found via live end-to-end testing, not guessed:** the
  Edge Function's service-role client bypasses RLS but **not** the
  `on_profile_role_change` trigger (migration `0001`) — triggers fire
  regardless of RLS bypass, and the trigger's own `current_user_role()`
  check resolves `auth.uid()` as `null` for a service-role connection
  with no forwarded JWT, so it correctly (from its own logic) rejected
  the very first role assignment on a brand-new account. Fixed with
  migration `0017`'s `set_initial_staff_role(p_user_id, p_role)` — a
  `security definer` function using `session_replication_role = replica`
  to skip triggers for just that one `UPDATE`, granted only to
  `service_role` (never `authenticated`/`anon` — it has no authorization
  check of its own, relying entirely on only the already-admin-gated
  Edge Function being able to call it).
- **A real bug found in two — then a third — pre-existing files that
  bypass `current_user_role()` entirely**, discovered by auditing every
  role-read call site before writing the plan (two), then again during
  live verification (a third, missed the first time): `middleware.ts`'s
  `resolveRole()`, `lib/get-current-role.ts`'s `getCurrentRole()`, and
  `components/auth/login-form.tsx`'s post-login redirect all did a raw
  `.select("role")` on `profiles` directly instead of calling the SQL
  function, so none of them would have respected `is_active` without
  being fixed directly. All three now do
  `.select("role, is_active")` and return `is_active ? role :
  "customer"`. The login-form gap wasn't a security hole (middleware
  still gates the actual pages) but would have briefly redirected a
  disabled account toward its old role home before getting bounced back.
- `lib/supabase/staff-data.ts` — query layer (DI'd like `menu-data.ts`
  etc.): `getStaffMembers`, `updateStaffMember` (plain `profiles`
  update — safe for `full_name`/`is_active`/non-initial `role` changes,
  since the trigger only blocks a role change from a non-admin caller,
  and only an admin session ever calls this), `createStaffAccount`
  (invokes the Edge Function).
- `components/admin/staff-accounts.tsx` + `staff-member-form.tsx` —
  real data + an unfiltered `postgres_changes` subscription on
  `profiles` (refetch via `getStaffMembers()`, same pattern as every
  other Realtime hook this initiative added — a column filter doesn't
  reliably combine with RLS-gated `postgres_changes`). Add Staff shows
  the generated password once in a dismissable panel with a copy
  button; Edit Staff disables the email field (not editable post-
  creation) and disables the active-toggle on the logged-in admin's own
  row (an admin can't lock themselves out).
- Verified live end-to-end with Playwright against the real deployment:
  created a real throwaway account, logged into it from a fresh browser
  context and confirmed it landed on `/staff/pos`, confirmed the new row
  appeared via Realtime on a second admin tab with no reload, disabled
  it and confirmed the still-logged-in session was redirected away from
  `/staff/pos` on its very next request (role re-resolves server-side,
  no stale-session risk) with the global role badge switching to
  "Khách Hàng"/Guest styling, re-enabled it and confirmed access came
  back with no re-login needed, and confirmed the real admin's own row
  has a disabled lock button. Cleaned up the throwaway account
  afterward; confirmed the real admin's own `is_active` was never
  touched by the test.

## Database (`supabase/migrations/`)

**Built and applied.** All 7 migrations have real SQL (from the plan doc's
Tasks 3–9) and are live on the hosted project `qhiypdqnrnzndxdwqxbx`, applied
in order via the Supabase MCP server's `apply_migration`: `0001_identity_and_roles`
→ `0002_shop_config` → `0003_menu` → `0004_inventory` → `0005_orders` →
`0006_payments_and_loyalty` → `0007_handle_order_paid`. Every table in
`public` has RLS enabled (confirmed via `list_tables`/`get_advisors`).
Full entity list: spec Section 2.

- Two more migrations were added later by
  `docs/superpowers/plans/2026-07-05-menu-data-migration.md`:
  `0008_menu_translations` (adds `name_vi`/`name_en`/`description_vi`/
  `description_en` bilingual columns to `categories`/`menu_items`, plus
  `menu_item_sizes`/`modifier_groups`/`modifiers` tables) and
  `0009_seed_menu_data` (seeds the real menu — the same 9 items/4
  categories that used to live in the deleted `lib/mock-data/menu.ts`).
  Both are applied to the same hosted project; see "Customer ordering
  flow" above for the resulting query module (`lib/supabase/menu-data.ts`).
- Two more after that, by `docs/superpowers/plans/2026-07-06-inventory-realtime.md`:
  `0010_inventory_i18n_and_stock_fn` (bilingual `name_vi`/`name_en`/
  `subtitle_vi`/`subtitle_en`/`icon` columns on `ingredients`, the
  `adjust_ingredient_stock` atomic RPC, and adding `ingredients`/
  `inventory_logs` to the `supabase_realtime` publication) and
  `0011_seed_inventory_data` (seeds the 4 ingredients that used to be
  `hooks/useInventory.tsx`'s hardcoded mock rows). See "Admin pages" above
  for the resulting query module (`lib/supabase/inventory-data.ts`) and
  Realtime wiring.
- Two more after that, by `docs/superpowers/plans/2026-07-06-tables-realtime.md`:
  `0012_tables_i18n_and_scan_fn` (bilingual `location_vi`/`location_en`,
  `is_occupied`, `scan_count` columns on `tables`; the guest-writable
  `security definer` `increment_table_scan_count` RPC and the admin-only
  `security invoker` `regenerate_table_qr_token` RPC; adding `tables` to
  the `supabase_realtime` publication) and `0013_seed_tables_data`
  (seeds the 6 tables that used to be `hooks/useTables.tsx`'s hardcoded
  mock rows). See "Table identity flow" above for the resulting query
  module (`lib/supabase/tables-data.ts`) and Realtime wiring.
- Two more after that, by `docs/superpowers/plans/2026-07-06-staff-accounts-realtime.md`:
  `0016_staff_active_and_directory_fn` (`profiles.is_active`, an updated
  `current_user_role()` that downgrades a disabled account to
  `'customer'`, the `get_staff_members()` directory function, and adding
  `profiles` to the `supabase_realtime` publication) and
  `0017_staff_role_bypass_fn` (`set_initial_staff_role()`, a
  `service_role`-only RPC that skips the `on_profile_role_change`
  trigger via `session_replication_role` for a new account's first role
  assignment — see "Staff accounts + Realtime" above for why the
  trigger blocked that assignment in the first place). See that section
  for the resulting query module (`lib/supabase/staff-data.ts`), the
  `create-staff-account` Edge Function, and Realtime wiring.
- pgcrypto was already installed on this project (needed for
  `gen_random_uuid()`/`gen_random_bytes()`) — no `create extension` step
  was actually required, despite the plan doc flagging it as a risk.
- A real admin account exists for testing `/admin/*` and `/staff/*`:
  `admin@phadincoffee.dev` (`profiles.role = 'admin'`). Created by
  inserting directly into `auth.users`/`auth.identities` via SQL (with
  `pgcrypto`'s `crypt()`/`gen_salt('bf')` for the password hash and
  `email_confirmed_at` pre-set), **not** through the public signup
  endpoint — that endpoint hit Supabase's shared email-send rate limit
  before it could even create the user row. Verified the account actually
  authenticates via a live call to `/auth/v1/token?grant_type=password`
  before relying on it.
- **Gotcha hit during setup:** `profiles`' own `on_profile_role_change`
  trigger (blocks non-admins from changing `role`) blocks the very first
  admin promotion too, since `current_user_role()` resolves to null for a
  raw SQL session with no `auth.uid()`. Bootstrapped past it with
  `alter table public.profiles disable trigger on_profile_role_change;`
  around the one-time `UPDATE ... SET role = 'admin'`, then re-enabled it
  immediately after. Only ever needed once, for the first admin.
- One more after that, by `docs/superpowers/plans/2026-07-07-stripe-payment-integration.md`:
  `0018_cancel_pending_order_fn` (the guest-safe `cancel_pending_order()`
  RPC — see "Stripe payment integration" above).

## Edge Functions (`supabase/functions/`)

All five payment-related Edge Functions are real and live: `place-order`
(creates a Stripe Checkout Session or a signed VNPay redirect URL
depending on `paymentMethod`), `stripe-webhook` (verifies Stripe's
signature, confirms/cancels orders), and `vnpay-ipn`/`vnpay-return`
(verify VNPay's signature; IPN is the source of truth for "paid," return
only redirects the browser and self-cancels on failure). See "Stripe
payment integration" and "VNPay payment integration" above.

## Deployment (Vercel)

Live at **https://phadincoffee.vercel.app** (project `phadincoffee` under
the `gnoltd-s-projects` team, linked to GitHub repo `Gnoltd/CoffeeShop` —
every push to `main` auto-deploys, no manual `vercel deploy` needed for
routine work). Per the user's explicit preference, verification going
forward should target this live URL, not `npm run dev`/localhost — local
`build`/`tsc`/`eslint`/`test` are still fine for fast feedback, just not
the source of truth for "does the feature actually work."

- Env vars are mirrored from `.env.local` into Vercel (Production/Preview/
  Development) via `vercel env add` whenever a new one is introduced
  locally — currently synced: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (in active use),
  `NEXT_PUBLIC_SITE_URL`, `VNPAY_RETURN_URL` (set to the real domain for
  Production/Preview, `localhost:3000` for Development — **still not
  read by any code**; VNPay's actual return URL is built dynamically in
  `place-order` pointing at the Supabase function URL instead, see "VNPay
  payment integration" above — this Vercel var is effectively dead),
  and `SUPABASE_SECRET_KEY`/`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/
  `VNPAY_TMN_CODE`/`VNPAY_HASH_SECRET` (real values, kept here for
  reference even though all four of the latter are actually read from
  **Supabase Edge Function secrets**, not Vercel's — see the next bullet).
- **Supabase Edge Function secrets (`Deno.env`) are a separate store from
  Vercel's env vars — syncing a variable to Vercel does not make it
  available inside an Edge Function.** Bit this project three times
  across the Stripe and VNPay work: `STRIPE_SECRET_KEY` and a new
  Edge-Function-only `SITE_URL` (the production domain, distinct from
  `NEXT_PUBLIC_SITE_URL` which is `localhost:3000` in `.env.local`) had
  to be set directly via the Supabase Dashboard (Edge Functions →
  Secrets) or `supabase secrets set`; `STRIPE_WEBHOOK_SECRET` was missed
  there too, silently breaking the webhook until caught via diagnostics;
  and `VNPAY_TMN_CODE`/`VNPAY_HASH_SECRET` needed the exact same manual
  step repeated for VNPay. See "Stripe payment integration" and "VNPay
  payment integration" above. No MCP tool in this project manages
  Supabase Edge Function secrets.
- **Supabase Auth's "URL Configuration" (Site URL + Redirect URLs
  allow-list) is a Dashboard-only setting** — no MCP tool exposes it. Site
  URL must be `https://phadincoffee.vercel.app` and Redirect URLs must
  include `https://phadincoffee.vercel.app/**`,
  `https://phadincoffee-*-gnoltd-s-projects.vercel.app/**` (preview
  deployments), and `http://localhost:3000/**` — otherwise signup's email
  confirmation link points at `localhost` instead of the live site. This
  was manually confirmed set as of 2026-07-06.

## Building the rest

All `design/stitch-exports/*.html` pages have been ported — there is no
remaining frontend UI to port from Stitch. What's left is backend: the DB
schema/RLS is applied (see "Database" above), Login/Signup/Logout are
real, menu data is real (`docs/superpowers/plans/2026-07-05-menu-data-migration.md`
— schema, seed, and every consumer rewired to `lib/supabase/menu-data.ts`,
`lib/mock-data/menu.ts` deleted), the Profile auth-gate + role-based
navigation is shipped, menu item extras/modifiers are admin-configurable,
and — as of 2026-07-06 — **all four "make all data real-time"
sub-projects are now shipped: Inventory, Tables, Orders (core,
Cash-only), and Staff accounts.** Inventory has real Supabase data +
Realtime + admin-configurable recipes (see the Admin pages section
above); Tables has a real table directory + a guest-writable scan-count
RPC (see "Table identity flow" above); Orders has real order
placement/tracking/KDS unification (see "Real orders + Realtime"
above); Staff accounts has real Supabase Auth account creation, an
`is_active` disable mechanism, and a real staff directory (see "Staff
accounts + Realtime" above). **All three payment methods are now real —
Cash, Stripe, and VNPay** (see "Stripe payment integration" and "VNPay
payment integration" above) — every payment button on both Checkout and
POS works end-to-end, verified live. This closes out the entire
payments follow-up from the Orders Realtime spec; no payment-related
backend work remains deferred. The app is also live on Vercel (see
"Deployment" above) — verify against the live URL, not localhost.
When adding any genuinely new page/feature beyond what's already built,
follow the same pattern used throughout: shared brand tokens (no
hardcoded hex), `useTranslations`/`getTranslations` for every label with
both `messages/vi.json` and `messages/en.json` updated together, Base
UI's `render` prop (not `asChild`) for polymorphic Buttons, and the
"disabled + tooltip" convention for any action with no backing table yet.
