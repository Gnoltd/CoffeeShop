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

**Now built:** the Supabase database — 11 migrations
(`supabase/migrations/0001`-`0011`) are applied to the live hosted project
(`qhiypdqnrnzndxdwqxbx`), every table has RLS enabled, and a real admin
account exists (`profiles.role = 'admin'`). Real Supabase Auth now backs
Login/Signup/Logout. Menu data (items/categories/sizes/modifier
groups/extras) is real — migrations `0008`/`0009` and
`lib/supabase/menu-data.ts`, see "Customer ordering flow" below. Inventory
(ingredients/stock/logs/recipes) is also real, and the first data source
in the app with **live Realtime sync** across sessions — migrations
`0010`/`0011` and `lib/supabase/inventory-data.ts`, see "Admin pages"
below. **Still not built:** Edge Functions, Stripe/VNPay integration, and
— outside of auth, menu, and inventory — every other mock data source in
the app (tables, orders, staff accounts) is still waiting on real queries
(+ Realtime) replacing the various `use*` hooks. See each feature section
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
    Stitch mockup 1:1) + inert "Live Orders" (current page) / disabled+tooltip
    "Order History" (no staff-facing route) / "Inventory" (manager/admin-only,
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

## Edge Functions (`supabase/functions/`)

Not yet built — `place-order`, `stripe-webhook`, `vnpay-ipn`, `vnpay-return`
are still comment-only `index.ts` stubs. Full handler code (with tests) is
in the plan doc's Task 11.

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
  Production/Preview, `localhost:3000` for Development — not read by any
  code yet), and `SUPABASE_SECRET_KEY`/`STRIPE_SECRET_KEY`/
  `VNPAY_TMN_CODE`/`VNPAY_HASH_SECRET` (real values, synced ahead of the
  code that will read them). `STRIPE_WEBHOOK_SECRET` stays empty — no
  Stripe webhook endpoint exists yet to generate one against.
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
and — as of 2026-07-06 — **Inventory is the first of the "make all data
real-time" sub-projects to ship** (real Supabase data + Realtime +
admin-configurable recipes, see the Admin pages section above). Edge
Functions (`place-order`, `stripe-webhook`, `vnpay-ipn`, `vnpay-return` —
full code in the scaffold plan doc's Task 11) are still comment-only
stubs, and the remaining "make all data real-time" sub-projects —
**Tables, Orders (+ unifying customer Checkout/Tracking with staff
POS/Kitchen Display), and Staff accounts**, in that order per `daily.md`
— still need their mock/local-Context data replaced with real Supabase
queries (+ Realtime where it matters). The app is also live on Vercel
(see "Deployment" above) — verify against the live URL, not localhost.
When adding any genuinely new page/feature beyond what's already built,
follow the same pattern used throughout: shared brand tokens (no
hardcoded hex), `useTranslations`/`getTranslations` for every label with
both `messages/vi.json` and `messages/en.json` updated together, Base
UI's `render` prop (not `asChild`) for polymorphic Buttons, and the
"disabled + tooltip" convention for any action with no backing table yet.
