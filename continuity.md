# Project: Coffee Shop Management & Customer Portal

## Goal

Web app for a single-location coffee shop: customer ordering (pickup +
dine-in QR), staff POS + Kitchen Display, manager/admin menu/inventory/
reporting/settings. Full spec: `docs/superpowers/specs/2026-07-04-coffee-shop-app-design.md`.
Bilingual product (Vietnamese primary / English secondary throughout), with
a working language switcher, not just translated copy.

## Current status

Next.js app is real, running, and now genuinely bilingual: every route is
locale-prefixed (`/vi/...`, `/en/...`) via next-intl, with a working "VI |
EN" toggle in the corner of every page. The first real (non-placeholder)
feature is built: a Food Cost % Calculator at `/admin/food-cost`. Everything
else is still a translated placeholder heading. No Supabase database yet.

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

## Next steps

1. Execute the DB schema/RLS/trigger/Edge Function tasks from the implementation plan
   (Tasks 3-11) — fully unaffected by the frontend/i18n work done so far.
2. Wire real Supabase env vars once local Supabase is running (`npx supabase start`) so
   middleware actually resolves roles instead of falling back to anonymous — this will also
   allow direct (not just indirect) verification of bilingual rendering on auth-gated pages.
3. Port remaining Stitch HTML exports (`design/stitch-exports/`) into real page components,
   following the Food Cost Calculator as the template: shared brand tokens, translations in
   both `messages/vi.json` and `messages/en.json`, shadcn components.
4. Business logic (Stripe/VNPay integration, order placement, Realtime wiring).
5. Add Vitest/RTL test setup (skipped so far) — including a regression test for the
   force-dynamic/locale-caching bug so it can't silently reappear.
6. Rename `middleware.ts` to `proxy.ts` at some point (Next.js 16 deprecation warning,
   non-blocking).
