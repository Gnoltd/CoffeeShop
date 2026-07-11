# "Elevated Warm" Redesign — Motion + Visual System Across All Pages (2026-07-12)

## Goal

Redesign the visual finish and interaction feel of every page (Customer,
Staff, Admin) around one consistent system: soft-depth cards, confident
typography, a warm color system in both light and dark mode, and motion
tuned to feel instant (interaction feedback under ~0.2s). This replaces
the flatter, thin-border look currently in production and extends the
existing customer-only motion system (`components/motion/*`, shipped
2026-07-09) to Staff (POS/KDS) and Admin, which never got it.

Business logic, routes, RLS, and data layers are untouched — this is a
presentation-layer project, same boundary as the prior
`2026-07-09-starbucks-customer-motion-design.md`.

## Decisions made during brainstorming

Brainstormed with the visual companion (mockup rounds); after several
rounds without landing on a single reference, the user delegated final
shape/depth judgment to the designer (this doc) while keeping firm,
explicit control over color.

| Question | Decision |
|---|---|
| Scope | All pages — Customer, Staff (POS/KDS), Admin. Admin was called "still fine" but wants reorganizing too, at lighter priority. |
| Home/Menu structure | **Marketing-First Hub**: hero banner + promo cards + category pills + item grid (richer version of what exists today), chosen over a no-hero "straight to ordering" layout and a Netflix-style horizontal-rail discovery layout. |
| Other Customer pages | Cart/Checkout/Orders stay **utility-first** (task flows, no hero/marketing chrome) — user did not object to this cascade when stated explicitly. Profile/Loyalty get a lighter version of the rich treatment (progress rings, reward imagery already exist, just re-skinned). |
| Card/component shape | Explored flat, hard-outline neubrutalist, soft-UI, glassmorphism, photo-immersive, editorial-minimal, liquid-glass, minimal-mono, gradient-mesh, and a Starbucks-app soft-shadow style — none fully landed after 8 rounds. **Delegated to designer**: soft rounded shadows (not hard outlines, not glass blur), see Design System below. |
| Color system | **User-specified explicitly, not delegated**: keep exact brand hues (`#b3341f` brick red, `#6f4e37` coffee brown, `#c9a66b` caramel, `#fff8f2` cream) for light mode; near-black coffee tones (`#1c1712`/`#2b2118`, never pure black) with lightened caramel/orange-red accents for dark mode — pattern locked from the first Cart & Checkout mockup shown. |
| Dark mode | In scope (real scope addition — no dark mode exists in the app today). Ships per-phase alongside each page group, not as a separate pass. |
| Staff/Admin visual intensity | Same design tokens/system as Customer (not a separate "toned down" language) — but density and motion *usage* differ by role (see Per-Surface Application). |
| Motion | Reuse `components/motion/*` (Framer Motion, already built for Customer) — extend the same primitives to Staff/Admin rather than building a second system. |
| Performance target | Interaction feedback under ~0.2s — tightened from the generic 300-600ms defaults common in motion libraries. |
| Review method | Given repeated inconclusive mockup rounds, the rollout is **pilot-first**: build one real page, deploy to Vercel, get live pixel-level feedback — matching this project's existing "verify on the deployed URL, not mockups" convention — rather than more static comparisons. |

## Design System

### Color tokens (`app/globals.css`)

Extends the existing `@theme`/`:root` block with dark-mode values. Hue
family is unchanged from today's brand tokens — only new
surface/card-level tokens and a dark variant are added.

| Token | Light | Dark |
|---|---|---|
| `--background` | `#fff8f2` (unchanged) | `#1c1712` |
| `--foreground` | `#3a2e22` (unchanged) | `#fff8f2` |
| `--card` | `#fffaf5` (new — subtly distinct from page bg) | `#2b2118` |
| `--card-foreground` | `#3a2e22` | `#fff8f2` |
| `--muted` (cream card variant, chips) | `#f9e9d4` (new) | `#241b14` |
| `--muted-foreground` | `#6f4e37` (coffee brown, unchanged) | `#c9a66b` (caramel) |
| `--primary` | `#b3341f` (unchanged) | `#e0663f` (lightened for AA contrast on dark) |
| `--accent` | `#c9a66b` (unchanged) | `#f2c88f` (lightened) |
| `--destructive` | `#c1440e` (unchanged) | `#e0663f` |
| `--price-highlight` (new token, drink/item prices) | `#b3341f` | `#ff8a5c` |
| `--border` | `#eee0d2` (existing-equivalent) | `#3a2e22` |

Theme switching: `prefers-color-scheme` as the default signal, with a
`data-theme="dark"|"light"` override on `<html>` for an explicit
user-facing toggle (new: Profile Settings gains a theme control). All
Tailwind usage stays semantic (`bg-card`, `text-primary`, etc.) per
CLAUDE.md's existing convention — no raw hex added to components.

### Shape & depth

- Two radius tiers: `--radius` (0.75rem/12px, unchanged, for inputs/chips/small
  controls) and a new `--radius-lg` (1rem/16px) for cards — menu items,
  cart rows, summary panels, promo cards.
- Soft, color-tinted shadows replace today's thin `1px solid border`
  card treatment: `--shadow-card` (`0 6px 16px -4px rgba(179,52,31,0.18)`
  light / `0 6px 16px -4px rgba(0,0,0,0.4)` dark), `--shadow-card-elevated`
  for summary/sticky panels (deeper). No hard offset shadows, no
  glass/blur effects.
- Photography gets more real estate: menu/cart item thumbnails move from
  small square icons to larger rounded-square crops (`aspect-square`,
  ~15-20% of card width vs. today's fixed small icon).

### Typography

No new font — Be Vietnam Pro stays (Vietnamese diacritic support is a
hard requirement, ruling out most trendy display fonts). Hierarchy is
pushed harder: headings move to 700-800 weight (vs. today's flatter
weight usage), section titles increase one step on the type scale,
body/label text stays 400-500. Prices get their own always-bold
treatment via the new `--price-highlight` token so they read at a glance
— this doubles as the "modern, confident" cue the brainstorming rounds
were circling without landing on a specific shape language for it.

### Motion (extends `components/motion/*`, no new library)

- All nine existing primitives (`route-transition`, `animated-tab-bar`,
  `segmented-control`, `bottom-sheet`, `animated-counter`, `stagger-list`,
  `press-feedback`, `progress-ring`, `step-progress`) get reused as-is —
  wired into Staff (POS/KDS) and Admin the same way they're already
  wired into Customer, not rebuilt.
- **Tightened durations** to hit the sub-0.2s feel: press/tap feedback
  ≤100ms, route/section transitions 150-200ms (down from Framer Motion's
  looser defaults), `AnimatedCounter`/`ProgressRing` tweens capped at
  200ms. Loading skeletons only appear for operations exceeding 300ms —
  fast responses never show a spinner flash, which reads as "slow" even
  when it isn't.
- Staff/Admin motion usage is **functional, not decorative**: stagger
  entrance on KDS board columns and Admin tables (helps parse a state
  change), `PressFeedback` on every actionable card/button, but no
  marketing-style flourishes (no hero parallax, no promo carousels) —
  those screens are used all shift, clarity and speed win over delight.
- `prefers-reduced-motion` fallback (already implemented in every
  primitive) is unchanged.

## Per-Surface Application

### Customer

- **Home/Menu**: Marketing-First Hub — hero banner, promo card row,
  category pills, item grid, all re-skinned with the card/shadow/type
  system above. `StaggerList`/`SegmentedControl`/`PressFeedback` already
  wired here from the 2026-07-09 motion project; visual finish updates
  only, no new motion wiring needed.
- **Cart/Checkout/Orders**: utility-first, no hero — item rows and a
  sticky order-summary panel (desktop split-column layout from the
  2026-07-11 responsive redesign is kept structurally, re-skinned).
- **Profile/Loyalty**: existing 2-column desktop split kept; progress
  ring/animated counters get the new shadow/color treatment.

### Staff (POS, KDS)

- Same design tokens, denser spacing (matches the existing 2026-07-09
  POS/KDS mobile-redesign layouts — those structural decisions are kept,
  only the visual finish and motion primitives are added on top).
- KDS order/table cards specifically benefit from the higher-contrast
  soft-shadow card treatment — easier to scan status at a glance across
  a kitchen than today's flatter cards.

### Admin

- Reorganization pass (lighter priority per the user, "still fine" but
  wants it improved) — same tokens/shadows/radius, existing sidebar/
  drawer structure (2026-07-09 admin-mobile-redesign) kept. Denser
  spacing scale than Customer (dashboard convention), functional motion
  only (stagger on table/KPI-card mount, no decorative motion).

## Performance Budget

| Interaction | Target |
|---|---|
| Tap/press visual feedback | ≤100ms |
| Route/section transition | 150-200ms |
| Counter/progress tween | ≤200ms |
| Loading skeleton threshold | only shown past 300ms wait |

Verified per-phase against the deployed Vercel URL (this project's
standing convention — not `npm run dev`), including a Lighthouse/manual
check that new shadow/blur usage doesn't regress paint performance on
mid-range mobile.

## Rollout Order (pilot-first)

1. **Pilot**: rebuild Menu (Home) + Cart/Checkout with the full new
   system (colors, shadows, typography, tightened motion, dark mode) and
   deploy. This is the first real, live thing the user reacts to —
   avoids further inconclusive static-mockup rounds.
2. Once the pilot is confirmed live, apply the same system to Orders
   (Tracking/History) and Profile/Loyalty.
3. Staff: POS, then KDS.
4. Admin: reorganization + re-skin pass (dashboard, menu mgmt, inventory,
   tables, staff, settings, shift).
5. Dark mode ships within each phase above, not as a trailing pass.

Each phase is independently deployable and verifiable, matching this
project's existing phased-rollout convention (see the 2026-07-09
Starbucks motion project for precedent).

## Out of Scope

- No backend/RPC/schema changes — purely presentational.
- No changes to `hooks/useCart.tsx`, `hooks/useOrders.tsx`,
  `hooks/useTables.tsx`, `hooks/useKitchenOrders.tsx`, or any
  `lib/supabase/*.ts` query layer.
- No new routes or information-architecture changes beyond what's
  already described (Marketing-First Hub is a richer version of the
  existing Home/Menu, not a new page).
- No color/hue changes — brand palette is fixed, only depth/shadow/
  typography/spacing evolve.
- Admin gets a lighter pass than Customer/Staff — reorganization +
  re-skin, not a structural rebuild.

## Verification Plan

- `npm run build` + `tsc` locally per phase for fast feedback.
- Push to `main`, verify each phase live at
  **https://phadincoffee.vercel.app** — this project's explicit
  convention over `npm run dev`.
- Per phase: click through in both `vi`/`en` locales, confirm existing
  function is unchanged (cart math, RLS-gated writes, Realtime
  subscriptions, deferred-payment flow), confirm dark/light toggle
  renders correctly, confirm `prefers-reduced-motion` still collapses
  animations, and time interaction feedback against the <0.2s budget
  above (manual — no automated perf harness in this project).
