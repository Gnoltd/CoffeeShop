# Project: Coffee Shop Management & Customer Portal

## Goal

Web app for a single-location coffee shop: customer ordering (pickup +
dine-in QR), staff POS + Kitchen Display, manager/admin menu/inventory/
reporting/settings. Full spec: `docs/superpowers/specs/2026-07-04-coffee-shop-app-design.md`.
Bilingual product (Vietnamese primary / English secondary throughout).

## Current status

The Next.js app is now real and running: `npm install`, `npm run build`,
and `npm run dev` all work, with all 20 routes compiling and role-based
middleware redirecting correctly even with no backend configured yet
(treated as anonymous). Every page is still a placeholder (renders just a
heading) — no real UI, no Supabase schema/data yet. Visual design (17
Stitch screens + exact exported HTML) and the structural skeleton are also
done. Next major phase: port the Stitch HTML into real page components,
and/or execute the DB schema/RLS/trigger tasks from the implementation plan.

## Completed

- Design spec written and approved (`docs/superpowers/specs/2026-07-04-coffee-shop-app-design.md`)
- Full implementation plan written with real code + tests for every file
  (`docs/superpowers/plans/2026-07-04-coffee-shop-scaffold.md`) — DB/RLS/Edge Function
  tasks (3-11, 15) not yet executed; Tasks 1, 2 (partial), 12, 13 effectively done (see below)
- Visual design completed in Stitch: design system "Highland Red & Brown Coffee"
  (internally auto-labeled "Phố Coffee" by Stitch) plus 17 screens covering every role,
  with exact HTML exports saved to `design/stitch-exports/`. See "Visual design assets" below.
- **Next.js app for real:**
  - Scaffolded via `create-next-app` (Next.js 16, App Router, TypeScript, Tailwind v4, ESLint),
    merged into the existing repo without touching our own `CLAUDE.md`/`continuity.md`/`daily.md`/skeleton
  - shadcn/ui initialized (`components.json`, `components/ui/button.tsx`, `components/ui/card.tsx`, `lib/utils.ts`)
  - `@supabase/supabase-js` + `@supabase/ssr` installed; `lib/supabase/client.ts` and `server.ts` implemented for real
  - `middleware.ts` implemented for real (role-based redirect logic for `/staff/*` and `/admin/*`),
    with a try/catch so a missing/unreachable Supabase backend degrades to "anonymous" instead of
    crashing every request — verified: public routes return 200, protected routes 307-redirect to `/login`
  - All 20 route placeholder pages (from the skeleton) turned into real minimal components so the
    build actually succeeds — still just render a heading each, no real feature UI yet
  - `npm run build` verified: exactly 20 routes, no duplicate-route errors (confirms the route-group
    collision fix from the design phase is correct in practice, not just in theory)
  - Known warning (non-blocking): Next.js 16 logs "the middleware file convention is deprecated,
    use proxy instead" — current `middleware.ts` still works, rename to `proxy.ts` later if desired

## Key decisions

- Supabase-only backend (no custom Express/API server) — RLS will be the real security boundary
- Single location, no branches table
- Loyalty: admin-configurable rates, defaults 10,000 VND spent = 1 point, 100 points = 10,000 VND discount
- Payments: Stripe (card), Cash, VNPay — all sandbox for now
- `staff` and `admin` are real URL-segment folders, not route groups (see CLAUDE.md)
- Visual style: warm/cozy, brick red (#B3341F) + coffee brown (#6F4E37) + caramel (#C9A66B) + cream (#F3E9DD),
  Be Vietnam Pro font, ROUND_TWELVE (~12px) corners. Chosen after rejecting an initial
  vibrant red/pink/purple palette (Material "VIBRANT" color variant).
- Bilingual UI: every screen has an "EN | VI" toggle pill in the header; labels show
  Vietnamese primary text with English secondary text beneath/alongside it.
- Middleware fails open to "anonymous" (not a crash) when Supabase is unreachable/unconfigured —
  deliberate resilience choice, not just a local-dev workaround.

## Visual design assets (Stitch)

- Stitch project: **"Coffee Shop App"** (project ID `4654820544595168289`), owned by this account.
- Design system asset ID: `assets/7846627771704298063` (name may display as "Phố Coffee" in the Stitch UI —
  that's Stitch's auto-generated internal display name, not a rename request; colors/fonts match what was agreed).
- 17 screens generated (final, correct-palette versions — earlier draft versions with the
  wrong vibrant/pink palette also exist in the project and should be ignored/deleted):
  Landing, Menu, Cart, Checkout, Order Tracking, Login, Signup, Profile, Loyalty (customer);
  POS, Kitchen Display (staff); Dashboard, Menu Mgmt, Inventory, Tables, Staff Accounts, Settings (admin).
- **Exact exported HTML for every screen** saved to `design/stitch-exports/01-landing.html` through
  `17-admin-settings.html`. Each file uses Tailwind CDN with a per-screen inline config embedding the
  exact color tokens, Google Fonts "Be Vietnam Pro" (body/headline) + "Public Sans" (labels), and the
  "Material Symbols Outlined" icon font. These are the literal source of truth for layout/spacing/icon
  choices — read the relevant export file when building each real page, don't re-derive from memory.
- Note: our real app uses Tailwind v4 (CSS-based `@theme`, no `tailwind.config.ts` file) via shadcn's
  setup in `app/globals.css` — when porting the Stitch color tokens in, add them there, not in a JS config file.

## Next steps

1. **Translate Stitch HTML → real Next.js pages**, one route at a time. For each page in `app/`
   (see CLAUDE.md route map), open the matching file in `design/stitch-exports/`, and port its
   structure/classes/icons into a React/Tailwind/shadcn component. Add the exact color tokens from
   the exports into `app/globals.css`'s `@theme` block. Replace raw Material Symbols `<span>` icons
   with a proper icon approach (e.g. `material-symbols` package or swap to `lucide-react`, already a
   shadcn convention, for a closer match to shadcn's own icon usage).
2. Execute the DB schema/RLS/trigger/Edge Function tasks from the implementation plan (Tasks 3-11) —
   fully unaffected by the frontend work done so far.
3. Wire real Supabase env vars once local Supabase is running (`npx supabase start`) so middleware
   actually resolves roles instead of falling back to anonymous.
4. Business logic (Stripe/VNPay integration, order placement, Realtime wiring).
5. Add the Vitest/RTL test setup from plan Task 2 (skipped in this pass to prioritize getting the
   app running) and the middleware/page tests from Tasks 12-13.
6. Clean up the Stitch project: delete the superseded wrong-palette draft screens if desired.
