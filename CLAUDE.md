# CLAUDE.md

Structural map of the Coffee Shop app. Full rationale lives in
`docs/superpowers/specs/2026-07-04-coffee-shop-app-design.md`. A full
implementation plan (DB schema/RLS/Edge Functions) is at
`docs/superpowers/plans/2026-07-04-coffee-shop-scaffold.md` — not yet executed.

## Current reality vs. planned

**Real and running:** Next.js app (App Router, TypeScript, Tailwind v4,
shadcn/ui), bilingual routing (next-intl), role-based middleware, and one
real feature (Food Cost Calculator). `npm run build`/`npm run dev` work.

**Still placeholder:** every other page renders only a translated heading —
no real feature UI. **Not yet built:** Supabase database (migrations exist
only as comment stubs), Edge Functions, Stripe/VNPay integration, Realtime.

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
  by section (`Nav`, `Landing`, `Auth`, `Customer`, `Staff`, `Admin`,
  `FoodCost`, ...). Add new keys to **both** files.
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

Follow `docs/superpowers/plans/2026-07-04-coffee-shop-scaffold.md` for the
DB/RLS/Edge Function tasks — unaffected by the frontend/i18n work done so
far. For remaining page UI, port `design/stitch-exports/*.html` (exact
Stitch-generated markup) into real components, same pattern as the Food
Cost Calculator: shared brand tokens, `useTranslations`/`getTranslations`
for every label, both `messages/vi.json` and `messages/en.json` updated together.
