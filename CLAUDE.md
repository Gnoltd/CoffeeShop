# CLAUDE.md

Structural map of PhaDinCoffee. Full rationale/history lives in
`docs/superpowers/specs/` and `docs/superpowers/plans/` — one dated
design+plan pair per feature (e.g. `2026-07-07-vnpay-payment-integration-{design,}.md`).
This file is the current-state summary; check the dated docs for "why" a
decision was made or the full bug-hunt narrative behind a fix.

## Status

Everything is real and shipped. Next.js app (bilingual, role-gated), full
customer/staff/admin UI, live Supabase DB (19 migrations) with RLS, live
Realtime sync across Inventory/Tables/Orders/Staff accounts, and all
three payment methods (Cash/Stripe/VNPay) work end-to-end. Deployed at
**https://phadincoffee.vercel.app**, auto-deploys on push to `main`. See
`daily.md` for what's currently open — it's kept short and recap-free by
design, so check it before this file for "what's left."

## Stack

Next.js (App Router) + Tailwind v4 + shadcn/ui + next-intl, talking
directly to Supabase (Postgres + Auth + Realtime) via its SDK. No custom
backend server — RLS is the access-control boundary; Edge Functions
handle logic needing secrets/atomicity (payments, order placement, staff
account creation).

## Roles

`profiles.role`: `customer | staff | manager | admin`. Staff =
POS+Kitchen Display. Manager = Staff + menu/inventory/tables/reports.
Admin = Manager + staff accounts/roles + shop/loyalty settings.
`profiles.is_active = false` downgrades a disabled staff/manager/admin
to `customer` everywhere (`current_user_role()` + RLS) without touching
their Auth login — a disabled employee can still walk in and order as a
customer, no separate ban/logout step. Role is never cached client-side,
always re-resolved server-side per request.

## Bilingual (i18n)

- next-intl, locale-prefixed routing (`/vi/...`, `/en/...`), `vi` default.
- Config: `i18n/routing.ts`, `i18n/navigation.ts` (locale-aware
  `Link`/`useRouter`), `i18n/request.ts`.
- `messages/vi.json`/`messages/en.json`, namespaced per section. Add new
  keys to **both**. `Brand.name` ("PhaDinCoffee") and third-party names
  like "VNPay" are identical in both files — proper nouns, not translated.
- Server components: `getTranslations()`. Client: `useTranslations()`.
- **`middleware.ts` is required for locale resolution, not just auth** —
  disabling it for any reason (even to bypass auth locally) silently
  breaks translations app-wide. Never bypass auth by hardcoding a role
  or removing middleware; seed real Supabase test data/sessions instead.
- `export const dynamic = "force-dynamic"` on the root layout is
  required (Next's route cache otherwise serves the wrong locale).
- `lib/format.ts`: `formatVND`, `formatNumber`, `formatDateVN`, `formatPhoneVN`.

## Theme (`app/globals.css`)

Tailwind v4 `@theme`/`:root` (no `tailwind.config.ts`). Brand: `--primary`
`#b3341f` (brick red), `--secondary` `#6f4e37` (coffee brown), `--accent`
`#c9a66b` (caramel), `--background` `#fff8f2`, `--foreground` `#3a2e22`.
`--destructive` `#c1440e` is a deliberately different hue from
`--primary`. `--radius: 0.75rem`. Font: Be Vietnam Pro (not Geist). Use
semantic Tailwind classes (`bg-primary` etc.), never hardcode hex.
Original mockup source: `design/stitch-exports/`.

## Route map

Relative to the locale prefix, under `app/[locale]/`:
- `(marketing)` — `/`
- `(auth)` — `/login`, `/signup`
- `(customer)` — `/menu`, `/menu/[itemId]`, `/cart`, `/checkout`,
  `/orders`, `/orders/[orderId]`, `/table/[qrToken]`, `/profile`, `/loyalty`
- `staff` — `/staff/pos`, `/staff/orders`, `/staff/orders/history`,
  `/staff/orders/history/[orderId]` (real URL segments, not route
  groups — a route group would collide with `(customer)`'s bare paths)
- `admin` — `/admin/dashboard`, `/menu`, `/inventory`, `/tables`,
  `/food-cost`, `/staff` (admin-only), `/settings` (admin-only)

`middleware.ts` (+ `lib/middleware-rules.ts` for the pure/testable
routing logic, extracted so it doesn't pull in `next-intl/middleware`
under Vitest) gates `/staff/*` (staff|manager|admin) and `/admin/*`
(manager|admin), plus exact-path gating on `/profile`/`/orders`/`/loyalty`
for logged-out guests (not `/orders/[id]`, reachable by guest checkout).
Fails open to anonymous on Supabase errors rather than crashing.

## Cross-cutting conventions & gotchas

Reusable facts that apply anywhere in the codebase, not tied to one feature.

- **Base UI, not Radix**: shadcn's `Button` wraps `@base-ui/react/button`
  — no `asChild`. For polymorphic rendering use `render`:
  `<Button render={<Link href="/x" />} nativeButton={false}>`.
- **Toggle switches need an explicit `left` position** on the thumb
  (`absolute left-0.5 top-0.5`, `translate-x-0`/`translate-x-5`) —
  omitting it makes the browser's static-position fallback push the
  "on" thumb outside the track.
- **The fixed `LanguageSwitcher`** (`app/[locale]/layout.tsx`,
  `fixed top-2 right-2 z-50`) can overlap admin header action buttons —
  admin layout uses `pt-16` to keep content clear of it.
- **Supabase Edge Function secrets (`Deno.env`) are a separate store
  from Vercel's env vars.** Syncing a var to Vercel does *not* make it
  available inside an Edge Function — it must also be set via the
  Supabase Dashboard (Edge Functions → Secrets) or `supabase secrets
  set`. Has bitten this project repeatedly (`STRIPE_SECRET_KEY`,
  `SITE_URL`, `STRIPE_WEBHOOK_SECRET`, `VNPAY_TMN_CODE`,
  `VNPAY_HASH_SECRET` all needed this separately). No MCP tool manages
  these secrets — it's a manual step every time.
- **Guest-safe RPC pattern**: any operation a logged-out guest needs
  (order tracking, order self-cancel, table QR scan count) is a narrow
  `security definer` function taking the row's id as a required
  parameter — never a broad RLS policy keyed on `customer_id is null`,
  which would let one guest bulk-read/affect every other guest's rows.
- **`handle_order_paid` trigger** (migration `0007`) only fires on an
  `UPDATE` transitioning `payment_status` to `'paid'`, never on
  `INSERT` — every order-creation path inserts at `pending` then does a
  real second `UPDATE` to flip it.
- **Postgres RPC parameter defaults don't apply when PostgREST sends
  explicit JSON `null`** (only when the arg is omitted) —
  `coalesce()` inside the function body if a default matters.
- **`order_type` enum is `pickup | dine_in`** (underscore) — client
  state uses hyphenated `"dine-in"` and must translate before any RPC
  call. Was a real bug (every dine-in order silently failed) until
  fixed 2026-07-07.
- **Any code reading `profiles.role` directly** (not via
  `current_user_role()` or a function built on it) risks ignoring
  `is_active` — three call sites needed fixing for exactly this once;
  grep for a raw `.select("role")` on `profiles` before adding a new one.
- **VND handling differs by payment gateway**: Stripe treats VND as
  zero-decimal (send the integer total as-is); VNPay always wants
  `total × 100` regardless of currency. Don't copy one convention into
  the other.
- **VNPay signs with PHP `urlencode()` convention** (`+` for space, not
  `%20`) — plain `encodeURIComponent` produces a wrong hash for any
  value containing a space (e.g. `vnp_OrderInfo`). Was a real bug until
  caught via live sandbox testing 2026-07-07; fixed with a shared
  `vnpayEncode()` helper used consistently everywhere VNPay data is
  signed or verified.
- **`supabase.functions.invoke()` always attaches an `Authorization`
  header, even for a guest** — for a guest it's the client's own
  publishable key, not a JWT. Forwarding it blindly breaks
  `auth.uid()` resolution; only forward when the token is actually
  JWT-shaped (3 dot-separated segments).
- **Query layers are DI'd**: every `lib/supabase/*.ts` module takes a
  `SupabaseClient` as its first argument (not importing a singleton),
  so it's testable with a mocked client. Follow this pattern for new
  query modules.
- **"disabled + tooltip" convention**: any UI action with no real
  backing table/RPC yet is rendered `disabled` with an explanatory
  `title`, never silently non-functional.
- **Realtime**: subscribe unfiltered to `postgres_changes` and refetch,
  rather than using a column `filter` — a filter doesn't reliably
  combine with RLS-gated Realtime (confirmed directly, more than once).
- **Verify against the deployed Vercel URL**
  (`https://phadincoffee.vercel.app`), not `npm run dev` — this
  project's explicit convention. Local `build`/`tsc`/`test` are fine for
  fast feedback but not the source of truth for "does it actually work."

## Feature areas

Each real feature has its own design spec + implementation plan under
`docs/superpowers/specs/`/`docs/superpowers/plans/`. Below is only what
you need to find your way around; check the dated docs for full detail.

### Customer ordering flow (`/menu`, `/cart`, `/checkout`, `/orders/[orderId]`, `/menu/[itemId]`)
- `hooks/useCart.tsx` — cart Context + localStorage, per-item notes, one
  hardcoded promo code (`WELCOME10`, 10% off).
- `lib/supabase/menu-data.ts` — menu query layer. Items, sizes,
  modifier groups/extras are real and admin-configurable
  (`components/admin/menu-item-form.tsx`'s "Extras"/"Recipe" sections).
- `hooks/useOrders.tsx` — Checkout/Tracking/History share one Context;
  wraps `get_order_for_tracking`/`getMyOrders` (real RPC/query, see
  "Orders + Realtime" below).
- Product Detail Page has its own sticky Add-to-Cart bar; reviews/
  ratings are still mock (`lib/mock-data/reviews.ts`) — no schema for
  them yet.
- Menu's "+" quick-add always adds directly to cart when an item needs
  no size decision (`hasSizeOptions && sizes.length > 0`); if it has
  extras, tapping "+" opens `components/customer/quick-add-extras-popup.tsx`
  (extras only, no size/note) instead of the full Product Detail page —
  tapping the item itself still opens the full page.
- `menu_items.has_size_options` (migration `0020`) lets admin hide the
  size picker for a single-size item regardless of how many
  `menu_item_sizes` rows exist — an explicit toggle in
  `menu-item-form.tsx`, not automatic based on row count.
- `lib/supabase/loyalty-data.ts` — real `getLoyaltyBalance`/
  `getLoyaltyTransactions`, backing the Loyalty page's balance and
  transaction history (was a hardcoded mock until 2026-07-08). Tier
  progress still has no real tier table — documented mock.
- Landing's "Scan QR at Table" is real camera scanning
  (`components/customer/qr-scanner-overlay.tsx`, `jsQR`, no other new
  dependency) — decodes a table's printed QR code and routes into the
  existing `/table/[qrToken]` flow untouched. Validates the decoded
  string against the table-URL *pathname* shape only (ignores hostname,
  so it also works against preview-deployment URLs) before navigating —
  see `lib/qr-table-token.ts`'s `extractTableToken`.
- **Known gap**: `checkout-view.tsx`'s initial `orderType` reads
  `activeTable` only once at first render, so it can default to
  "pickup" if `activeTable` populates moments later (right after a
  reload, before `TablesProvider`'s localStorage hydration effect runs).

### Landing / Auth / Profile / Loyalty / Order History
- Login/Signup use real Supabase Auth; redirect to `ROLE_HOME[role]`
  (`lib/roles.ts`, shared with `middleware.ts`). Google OAuth buttons
  are disabled+tooltip (no client configured). Signup email
  confirmation frequently fails — this hosted project's shared email
  sender has a very low rate limit; no MCP tool can configure SMTP.
- `lib/get-current-role.ts` (`getCurrentRole(supabase)`) resolves role
  server-side for the "Go to [X]" shortcut shown to logged-in
  staff/admin browsing the customer side.
- Loyalty rates are real (`loyalty_settings`: 10,000 VND = 1 point, 100
  pts = 10,000 VND off); rewards catalog/redemption UI is
  disabled+tooltip (no table).
- Profile's inline-editable fields (name/phone/email) are local-state
  only, not yet persisted; Logout is real (`supabase.auth.signOut()` →
  `/menu` as guest, not `/login` — guest ordering stays available).

### Staff pages (`/staff/pos`, `/staff/orders`, `/staff/orders/history`)
- POS (`components/staff/pos-terminal.tsx`) — **known gap**: no
  size/modifier picker, adds items at base price only. Local ticket
  state, not `useCart` (a separate staff-side transaction).
- Kitchen Display — `components/staff/{kitchen-board,kitchen-top-bar,
  kitchen-sidebar,kitchen-stats-footer}.tsx`, orchestrated by
  `kitchen-display.tsx`. Board maps the real 6-state `order_status`
  enum (`pending_payment → paid → preparing → ready →
  completed/cancelled`); stats footer/sidebar shift-stats are all
  computed live, not mock.
- `hooks/useKitchenOrders.tsx` — shared Context for POS+KDS; `advance()`
  is the single choke point for status changes; deliberately not
  persisted to localStorage (matches pre-existing reset-on-reload
  behavior).
- Staff Order History (`/staff/orders/history[/[orderId]]`) —
  staff-wide order lookup, distinct from the customer's own history.
  `get_order_history()` RPC (migration `0019`) does search/filter/
  pagination in one round trip; `lib/supabase/orders-data.ts`'s
  `getOrderHistory`/`getOrderHistoryDetail`; `hooks/useOrderHistory.tsx`
  is a plain hook (not Context — nothing else shares this data).

### Admin pages (`/admin/dashboard`, `/menu`, `/inventory`, `/tables`, `/staff`, `/settings`)
- One left-sidebar shell (`components/admin/admin-sidebar.tsx` +
  `app/[locale]/admin/layout.tsx`) for all routes.
- `hooks/useInventory.tsx` (shared Dashboard+Inventory) — real stock
  adjustment via `adjust_ingredient_stock` RPC (atomic, clamps at 0),
  real `inventory_logs`, admin-configurable recipes
  (`menu_item_ingredients`/`modifier_ingredients`, feeding the
  `handle_order_paid` deduction trigger).
- `hooks/useTables.tsx` (shared Admin Tables + Table QR flow) — real
  rename/location/occupied-toggle, all Realtime.
  `regenerate_table_qr_token` (admin-only) and
  `increment_table_scan_count` (the one guest-writable `security
  definer` RPC in this flow, scoped to only ever touch `scan_count`)
  back the two operations plain RLS updates can't safely express.
  `activeTable` (a browser tab's dine-in session) deliberately keeps
  `localStorage` persistence — must survive a locale-switch remount.
- Menu Management: real image upload (`URL.createObjectURL`,
  `ownsPreviewUrl` flag prevents revoking a blob URL still live
  elsewhere), real pagination, real Add/Edit.
- Staff Accounts: `create-staff-account` Edge Function creates a real
  Auth account + shows a one-time generated password; `profiles` rows
  can only be created via the `handle_new_user` trigger, so this can't
  be a plain insert. `set_initial_staff_role()` RPC (migration `0017`)
  works around `on_profile_role_change`'s trigger blocking the very
  first role assignment on a service-role connection with no JWT.
- **Known gap**: Dashboard's revenue/orders/loyalty KPIs and trend
  badges remain fixed mock numbers — no `orders`/`loyalty_transactions`
  aggregation built; deliberately not faked further than that.

### Orders + Realtime (core, all real)
- `place_order` RPC (`security definer`) — the only place order money
  is computed; never trusts client-supplied prices. Always inserts
  `pending_payment`/`pending`, second `UPDATE` to `paid` when already
  collected (POS).
- `get_order_for_tracking` / `cancel_pending_order` — guest-safe
  single-row RPCs (see "Guest-safe RPC pattern" above).
- `place-order` Edge Function wraps `place_order` with the service-role
  key (see the JWT-forwarding gotcha above).
- A guest's own tracking page has no Realtime path (would require a
  bulk-guest-visibility RLS leak) — polls `get_order_for_tracking`
  every 10s instead, labeled in the UI as polling. Logged-in
  customers/staff get true Realtime.

### Payments — Cash, Stripe, VNPay (all real, all end-to-end verified live)
- **Cash**: self-checkout starts `pending_payment`; staff confirms via
  `components/staff/kitchen-pending-payment.tsx`'s "Confirm Cash
  Received" (`confirmCashPayment`, plain update). POS cash collects in
  person, skips straight to `paid`.
- **Stripe**: `place-order` creates a real Checkout Session (raw
  `fetch`, no SDK) when `paymentMethod === "stripe"` and not already
  collected; 30-min `expires_at`. `stripe-webhook` (HMAC-SHA256 via Web
  Crypto) is the source of truth for "paid" —
  `checkout.session.completed`/`.expired` flip the order via a guarded
  `UPDATE ... WHERE payment_status = 'pending'`. POS's Card option
  reuses the `'stripe'` enum value (no separate `'card'` value), sends
  `paymentCollected: true`, skips the Stripe branch entirely.
- **VNPay**: `place-order` builds a locally-signed redirect URL (no API
  call needed). `vnpay-ipn` (server-to-server, source of truth, VNPay's
  `{RspCode, Message}` response contract) and `vnpay-return` (single
  return URL for every outcome, distinguished by `vnp_ResponseCode`;
  calls `cancel_pending_order` on failure) are both real. POS's VNPay
  option has its own real `'vnpay'` enum value.
- All three share `cancel_pending_order` for self-cancel/expiry cleanup.
- Out of scope for all three: refunds/disputes (handled manually via
  each gateway's dashboard), any in-person card/QR reader hardware
  integration (Stripe Terminal etc.).

## Database (`supabase/migrations/`)

19 migrations applied to the live hosted project (`qhiypdqnrnzndxdwqxbx`)
via the Supabase MCP server's `apply_migration`. Every table in `public`
has RLS enabled (confirmed via `list_tables`/`get_advisors`).

| Range | Covers |
|---|---|
| `0001`–`0007` | identity/roles, shop config, menu, inventory, orders, payments/loyalty, `handle_order_paid` trigger |
| `0008`–`0009` | menu bilingual columns + real menu seed |
| `0010`–`0011` | inventory bilingual columns + `adjust_ingredient_stock` RPC + seed |
| `0012`–`0013` | tables bilingual columns + scan/QR-regen RPCs + seed |
| `0014`–`0015` | `place_order`/`get_order_for_tracking` RPCs + Realtime publication fix |
| `0016`–`0017` | `profiles.is_active` + `get_staff_members()` + `set_initial_staff_role()` |
| `0018` | `cancel_pending_order()` (Stripe follow-up) |
| `0019` | `get_order_history()` (Staff Order History) |

A real admin account (`admin@phadincoffee.dev`) was bootstrapped via
direct SQL insert into `auth.users` (public signup hits the shared email
rate limit). Two throwaway test accounts (staff/customer roles) also
exist — credentials in `.env.local` and the gitignored `test-accounts.md`.

## Edge Functions (`supabase/functions/`)

All real: `place-order` (routes to Stripe/VNPay/cash based on payload),
`stripe-webhook`, `vnpay-ipn`, `vnpay-return`, `create-staff-account`.
None use an SDK for their respective gateway — raw `fetch`/Web Crypto
throughout, matching this project's dependency-free convention. No Deno
test harness exists in this project — Edge Functions are verified live
(curl smoke tests + real sandbox transactions), not with automated tests.

## Deployment (Vercel)

Live at **https://phadincoffee.vercel.app** (project `phadincoffee`,
`gnoltd-s-projects` team, linked to `Gnoltd/CoffeeShop` — push to `main`
auto-deploys, no manual `vercel deploy` needed).

- Vercel env vars: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`,
  `SUPABASE_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_RETURN_URL` (dead —
  VNPay's real return URL is built dynamically pointing at the Supabase
  function URL, not this var). The Stripe/VNPay secrets are *also*
  separately required as **Supabase Edge Function secrets** — see
  Cross-cutting conventions above; Vercel and Supabase are two
  different secret stores.
- **Supabase Auth's "URL Configuration" (Site URL + Redirect URLs) is
  Dashboard-only**, no MCP tool exposes it. Must include
  `https://phadincoffee.vercel.app/**`, the Vercel preview-deployment
  wildcard, and `http://localhost:3000/**`.

## Building the rest

All Stitch-designed pages are ported; all four "make all data
real-time" sub-projects (Inventory, Tables, Orders, Staff accounts) and
all three payment methods (Cash, Stripe, VNPay) are shipped and
verified live. No backend work remains deferred as of this writing —
check `daily.md` for what's currently open. When adding anything new:
shared brand tokens, `useTranslations`/`getTranslations` with both
message files updated together, Base UI's `render` prop for polymorphic
Buttons, "disabled + tooltip" for unbacked actions, DI'd query-layer
modules, guest-safe RPCs for anything a logged-out user needs to touch.
