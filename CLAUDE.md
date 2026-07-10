# CLAUDE.md

Structural map of PhaDinCoffee. Full rationale/history lives in
`docs/superpowers/specs/` and `docs/superpowers/plans/` — one dated
design+plan pair per feature (e.g. `2026-07-07-vnpay-payment-integration-{design,}.md`).
This file is the current-state summary; check the dated docs for "why" a
decision was made or the full bug-hunt narrative behind a fix.

## Status

Everything shipped so far is real end-to-end. Next.js app (bilingual,
role-gated), full customer/staff/admin UI, live Supabase DB (33
migrations) with RLS, live Realtime sync across Inventory/Tables/Orders/
Staff accounts, 3-state table occupancy/cleaning, deferred (Pay
Now/Pay Later) payment with method-chosen-at-serving-time (including
a served-but-unpaid order's method being changeable/undoable), all
three payment methods (Cash/Stripe/VNPay), real customer reviews, real
admin menu-image upload, real Profile persistence, real Admin
Dashboard KPIs, shift closing (cash reconciliation), real Google
sign-in, real Profile Settings (password change + Google account
linking), an admin-editable per-item Sizes editor, and a real
forgot-password/reset-via-email flow all work end-to-end. Deployed at
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
  `/food-cost`, `/shift`, `/staff` (admin-only), `/settings` (admin-only)

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
- **A Postgres `AFTER UPDATE OF column_name` trigger only fires when
  the client's own UPDATE statement names that column** — not when
  another `BEFORE` trigger changes it as a side effect. Was a real bug:
  `sync_table_occupancy` (scoped to `OF status`) never fired when a
  deferred-payment order completed via a `payment_status`-only update
  (the `complete_order_when_served_and_paid` trigger flipped `status`
  internally, invisibly to the column scope) — a table could finish an
  order and never get freed. Fixed (migration `0024`) by dropping the
  column scope; the function's own body already gates its logic
  correctly, matching the unscoped pattern `handle_order_paid` and
  `complete_order_when_served_and_paid` already used.
- **Every RLS policy needs checking against all roles that can reach
  the UI surface calling it**, not just the role that happens to be
  logged in during a given test pass. `tables_admin_all` only granted
  `manager`/`admin` — but KDS (staff-reachable) exposes a table-status
  action too. A plain `staff` account got silently rejected until
  `tables_update_staff` (migration `0025`) was added. Pair this with
  always attaching `.catch()` to a Supabase write in the UI — an
  RLS denial with no error handling looks identical to "button does
  nothing," which is far harder to diagnose than a shown error message.
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
- Product Detail Page has its own sticky Add-to-Cart bar; reviews are
  real (see "Reviews" below), shown here with the real aggregate rating.
- Menu's "+" quick-add always adds directly to cart when an item needs
  neither a size decision nor extras; otherwise tapping "+" opens
  `components/customer/quick-add-popup.tsx` (`QuickAddPopup` — handles
  both size selection and extras, not extras-only despite the older
  `quick-add-extras-popup.tsx` name still floating around in commit
  history) instead of the full Product Detail page — tapping the item
  itself still opens the full page.
- `menu_items.has_size_options` (migration `0020`) lets admin hide the
  size picker for a single-size item regardless of how many
  `menu_item_sizes` rows exist — an explicit toggle in
  `menu-item-form.tsx`, not automatic based on row count.
- Single-option modifier groups (extra shot, extra milk, etc.) render as
  one grouped list with prices shown inline, not one grid-column per
  extra — `product-detail.tsx`/`quick-add-popup.tsx` split
  `modifierGroups` into `extraGroups` (`options.length === 1`) vs
  `otherGroups` (`options.length > 1`, unchanged grid layout with prices
  added).
- `lib/supabase/loyalty-data.ts` — real `getLoyaltyBalance`/
  `getLoyaltyTransactions`, backing the Loyalty page's balance and
  transaction history (was a hardcoded mock until 2026-07-08). Tier
  progress is real too (2026-07-10): `loyalty_tiers` table (migration
  `0034`, Bronze/Silver/Gold/Diamond by lifetime points earned,
  bilingual `name_vi`/`name_en`) + `get_my_loyalty_tier_progress()` RPC
  (no args, resolves `auth.uid()` internally, returns current/next tier
  name + points-to-next + progress percent), surfaced via
  `getLoyaltyTierProgress` and the Loyalty page's tier card (localized
  tier name, real `ProgressRing`, and a max-tier "reached the top"
  message when there's no next tier).
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
  (`lib/roles.ts`, shared with `middleware.ts`). Google OAuth sign-in
  is real (both buttons call `signInWithOAuth`; a callback page at
  `app/[locale]/(auth)/callback/page.tsx` — note this resolves to the
  bare URL `/<locale>/callback`, since `(auth)` is a route group and
  contributes no URL segment, same as `login`/`signup` — resolves role
  via `getCurrentRole` and redirects to `ROLE_HOME[role]`). Signup email
  confirmation frequently fails — this hosted project's shared email
  sender has a very low rate limit; no MCP tool can configure SMTP.
- Login's "Forgot password?" is real: a 3-view swap inside
  `login-form.tsx` (`"login" | "requestReset" | "resetSent"`) calls
  `supabase.auth.resetPasswordForEmail`, always landing on a
  Signup-style "check your email" screen regardless of whether the
  address is registered (Supabase's anti-enumeration behavior — never
  reveal account existence). The emailed link lands on
  `/reset-password` (`app/[locale]/(auth)/reset-password/page.tsx` +
  `components/auth/reset-password-view.tsx`) — same bare-URL route-group
  lesson as `/callback`. That page waits on `onAuthStateChange` for the
  session the recovery link establishes (same pattern as the OAuth
  callback), then reuses Settings' change-password form pattern
  (`updateUser({ password })`) before redirecting via
  `getCurrentRole`/`ROLE_HOME`. Shares the same shared-email-sender
  rate-limit risk as signup confirmation — shipped anyway per explicit
  decision; the real-emailed-link round trip is unconfirmed, see
  `daily.md`.
- `lib/get-current-role.ts` (`getCurrentRole(supabase)`) resolves role
  server-side for the "Go to [X]" shortcut shown to logged-in
  staff/admin browsing the customer side.
- Loyalty rates are real (`loyalty_settings`: 10,000 VND = 1 point, 100
  pts = 10,000 VND off); rewards catalog/redemption UI is
  disabled+tooltip (no table).
- Profile's name/phone are real (`lib/supabase/profile-data.ts`,
  `profiles_update_own` RLS), inline pencil-edit writes through directly
  (no RPC needed). Email is the real logged-in Auth email, deliberately
  **read-only** — no `profiles.email` column exists, and editing the
  real Auth email would trigger Supabase's confirmation-email flow
  (rate-limit gotcha, see Auth above). Logout is real
  (`supabase.auth.signOut()` → `/menu` as guest, not `/login` — guest
  ordering stays available).
- Profile's "Settings" row is real: `/profile/settings`
  (`components/customer/profile-settings-view.tsx`, gated behind login
  via `lib/middleware-rules.ts`'s `AUTH_REQUIRED_EXACT_PATHS` — note
  this list is exact-match, not prefix-match, so a new page nested under
  an already-gated path still needs its own entry). Change Password
  calls `supabase.auth.updateUser({ password })` directly (no "current
  password" field — already-authenticated session). Connect/Disconnect
  Google uses real identity linking (`linkIdentity`/`unlinkIdentity`/
  `getUserIdentities`) — requires "Manual linking" enabled in the
  Supabase Dashboard (Authentication → configuration, off by default,
  no MCP tool for it). "Unlink" is only ever rendered enabled when the
  account has 2+ linked identities, mirroring Supabase's own
  server-side rule for the same thing — this is what actually prevents
  anyone locking themselves out, not custom logic.

### Reviews (real, all end-to-end)
- `menu_item_reviews` table + three `security definer` RPCs:
  `submit_menu_item_review` (verified-purchase only — requires a real
  `completed` order containing the item; upserts on
  `(menu_item_id, customer_id)`, so resubmitting edits the existing
  review rather than duplicating it), `reply_to_review`
  (manager/admin only), `get_menu_item_reviews` (public read,
  `security definer` because resolving the reviewer's display name
  needs `profiles.full_name`, which plain RLS would block for anyone
  who isn't that reviewer or staff). `lib/supabase/reviews-data.ts` is
  the query module.
- Submission lives on the customer's own Order Tracking/History detail
  page (`/orders/[orderId]`, shared component) — a "Rate & Review"
  action per item, shown only once that order is `completed`.
- `reviewerName` is `string | null` throughout (a reviewer's
  `profiles.full_name` is frequently unset) — always render with a
  translated "anonymous" fallback, never assume non-null.
- Admin/manager can post one public reply per review from a panel in
  the Menu Management item editor (`menu-item-reviews-panel.tsx`).

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
- `hooks/useTables.tsx` (shared Admin Tables + Table QR flow + KDS
  Tables column) — real rename/location, plus `status` (see "Table
  status" below), all Realtime.
  `regenerate_table_qr_token` (admin-only) and
  `increment_table_scan_count` (the one guest-writable `security
  definer` RPC in this flow, scoped to only ever touch `scan_count`)
  back the two operations plain RLS updates can't safely express.
  `activeTable` (a browser tab's dine-in session) deliberately keeps
  `localStorage` persistence — must survive a locale-switch remount.
- Menu Management: real Sizes editor — admin can add/remove/reorder
  per-item sizes with an editable name + price each (e.g. a drink can
  offer only M/L, not S), backed by `menu_item_sizes.sort_order`
  (migration `0033`) and `lib/supabase/menu-data.ts`'s `setItemSizes`
  (bulk delete-then-insert, called from `menu-management.tsx`'s
  `saveItem`).
- Menu Management: real image upload — `menu-item-form.tsx` shows an
  instant local `URL.createObjectURL()` preview (`ownsPreviewUrl` flag
  prevents revoking a blob URL still live elsewhere), then on Save
  actually uploads to the public `menu-item-images` Storage bucket
  (admin/manager-only write) and persists the real public URL. (Was
  genuinely broken until 2026-07-09 — the blob URL was silently
  discarded on save instead of uploaded; fixed.) Real pagination, real
  Add/Edit. List/preview thumbnails are a consistent square crop
  (`object-cover`).
- Staff Accounts: `create-staff-account` Edge Function creates a real
  Auth account + shows a one-time generated password; `profiles` rows
  can only be created via the `handle_new_user` trigger, so this can't
  be a plain insert. `set_initial_staff_role()` RPC (migration `0017`)
  works around `on_profile_role_change`'s trigger blocking the very
  first role assignment on a service-role connection with no JWT.
- Dashboard's revenue/orders/loyalty KPIs, 7-day chart, and best
  sellers are real (`get_dashboard_stats()` RPC, migration `0026`),
  Realtime on `orders`/`order_items`/`loyalty_transactions`. A 5-sheet
  `.xlsx` export button (`xlsx`/SheetJS) sits alongside it. The Revenue
  card links to `/admin/shift` (see "Shift closing" below).

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

### Table status — occupancy + cleaning (all real, shipped 2026-07-08)
- `tables.status` (migration `0021`) is a 3-state enum — `available |
  occupied | cleaning` — replacing the old `is_occupied` boolean.
- **Occupied**: automatic — `sync_table_occupancy` trigger fires on a
  dine-in order `INSERT`, regardless of payment status.
- **Cleaning**: automatic — same trigger, fires when a table's *last*
  active order reaches `completed`/`cancelled`. Deliberately not the
  same event as "guest left" — a finished order always routes through
  Cleaning, never straight to Available.
- **Available**: always a manual staff tap ("Cleaning Done") — never
  automatic. Two surfaces call the same `setStatus`: the KDS "Tables"
  4th board column (`components/staff/kitchen-tables-column.tsx`) and
  Admin Tables (`components/admin/tables-management.tsx`, a 3-state
  contextual button, not a binary toggle).
- Guests scanning a `cleaning` table's QR get a blocked message with a
  "Notify Staff" button — guest-safe `notify_table_cleaning` RPC (sets
  `cleaning_notified_at`), shown as an urgent badge on the KDS table
  card until cleared.
- Admin Dashboard has a real-time "Table Status" card (3-way counts +
  a cleaning-attention alert), alongside the real KPI cards above it
  (see Admin pages above).
- Design: `docs/superpowers/specs/2026-07-08-table-status-design.md`;
  plan: `docs/superpowers/plans/2026-07-08-table-status.md`.

### Deferred payment + service lifecycle (all real, shipped 2026-07-08)
- New `served` order status (between `ready` and `completed`) — set
  from the table's own card in the KDS Tables column for dine-in (not
  the order card), or the existing Ready-column tap for pickup (no
  table to attach a Served action to).
- Checkout offers **Pay Now / Pay Later**. Pay Now is the unchanged
  existing flow (payment method picked at checkout, before the kitchen
  ever sees the order). Pay Later shows **no payment method picker at
  checkout at all** — the order reaches the kitchen immediately
  (bypasses `pending_payment`), and both the method and the payment
  itself are chosen only once the order is `served`:
  - **Customer** picks Cash/Card/VNPay on their own tracking page (a
    3-way picker) — Cash just records the choice for staff to collect
    in person; Card/VNPay records it and redirects to that gateway
    immediately.
  - **Staff** can also mark Cash directly from the table's card in KDS
    ("Mark Cash") — Stripe/VNPay stay customer-only, since staff can't
    complete a hosted checkout on the guest's behalf.
  - `orders.payment_method` is nullable (migration `0023`);
    `place_order` only requires it when `payAt = 'now'`.
- **Auto-completion**: `complete_order_when_served_and_paid` trigger
  (migration `0022`) promotes an order to `completed` the instant it's
  both `served` and `payment_status = 'paid'`, regardless of which
  becomes true first — a Pay Now order satisfies payment before
  serving, so tapping Served completes it immediately; a Pay Later
  order satisfies serving first and waits on payment.
- New `pay-order` Edge Function — customer-triggered deferred
  Stripe/VNPay checkout-session creation, reusing `place-order`'s
  session-building logic but invoked later against an existing order.
  `stripe-webhook`/`vnpay-ipn`/`vnpay-return` were all corrected to
  branch on the order's *current* status, so a served-but-unpaid order
  is never wrongly regressed back to `paid` or cancelled by a stale
  payment attempt.
- Checkout now **requires a real scanned table for Dine-in** — the
  toggle is disabled until `activeTable` is set (no more fake
  fallback table number sending `table_id: null`, which used to make
  an order invisible to the entire table-driven KDS model).
- **Payment method correction** (real, shipped 2026-07-10): a
  served-but-unpaid order's recorded method can be changed or reset.
  `change_order_payment_method(p_order_id, p_method default null)`
  (guest-safe `security definer`, migration `0032`) only acts while
  `status = 'served' AND payment_status = 'pending'`; `null` resets to
  "no method chosen." Two surfaces: the customer's tracking page
  ("Change payment method" under the Cash-awaiting note, "Choose a
  different method" next to the gateway retry button) and KDS's table
  card (an "Undo" button next to Confirm Cash — dine-in only, no
  pickup equivalent, see known gaps below).
- Design: `docs/superpowers/specs/2026-07-08-deferred-payment-service-lifecycle-design.md`
  (see its "Revision" section for the method-also-deferred correction);
  plan: `docs/superpowers/plans/2026-07-08-deferred-payment-service-lifecycle.md`.
  Payment method correction: `docs/superpowers/specs/2026-07-10-payment-method-correction-design.md` /
  `docs/superpowers/plans/2026-07-10-payment-method-correction.md`.

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

### Shift closing (real, shipped 2026-07-10)
- `/admin/shift` — cash reconciliation: open a shift with a starting
  cash amount, a live report tracks cash orders against it, close with
  a counted amount to get an over/short summary.
- `shifts` table + `orders.paid_at` column + three RPCs (migration
  `0031`): open/report/close. `open_shift` errors cleanly (shown, not
  crashed) if a shift is already open — only one open shift at a time.
- `lib/supabase/shift-data.ts` query module; reachable from Admin
  Dashboard's Revenue KPI card and the Admin sidebar. Manager/admin
  only (same gate as the rest of `/admin/*`).
- Plan: `docs/superpowers/plans/2026-07-10-shift-closing.md`; design:
  `docs/superpowers/specs/2026-07-10-shift-closing-design.md`.

## Database (`supabase/migrations/`)

33 migrations applied to the live hosted project (`qhiypdqnrnzndxdwqxbx`)
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
| `0020` | `menu_items.has_size_options` (per-item size-picker toggle) |
| `0021` | `tables.status` 3-state enum + occupancy/cleaning trigger + `notify_table_cleaning()` guest RPC |
| `0022`–`0023` | `served` order status + auto-completion trigger + `payAt`/nullable `payment_method` (deferred payment) |
| `0024` | fixed `sync_table_occupancy`'s trigger column-scope gap (see gotcha below) |
| `0025` | `tables_update_staff` RLS policy (staff-role gap, see gotcha below) |
| `0026` | `get_dashboard_stats()` (real Admin Dashboard KPIs) |
| `0027` | `menu_item_reviews` table + review RPCs |
| `0028` | `menu-item-images` public Storage bucket |
| `0029` | `get_order_for_tracking` carries `menuItemId` (needed by reviews) |
| `0030` | `get_order_history()` date filters made null-safe (removed a silent 7-day default) |
| `0031` | `shifts` table + `orders.paid_at` + shift open/report/close RPCs |
| `0032` | `change_order_payment_method()` (Pay Later method correction) |
| `0033` | `menu_item_sizes.sort_order` (admin Sizes editor display order) |

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

All Stitch-designed pages are ported; all four original "make all data
real-time" sub-projects (Inventory, Tables, Orders, Staff accounts),
all three payment methods (Cash, Stripe, VNPay), table occupancy/
cleaning, deferred payment + service lifecycle, payment method
correction, real reviews, real menu-image upload, real Profile
persistence, the admin Sizes editor, and the Admin/KDS/POS nav-link
gaps are shipped and verified live. Google sign-in and Profile Settings
(password change + Google account linking) are shipped and
live-verified end-to-end. Forgot password is shipped and verified live
except for the actual emailed-link round trip (shared email-sender
rate-limit risk, same as signup confirmation). Real Admin Dashboard
KPIs and shift closing (above) are shipped but still need a hand
live-verification pass — see `daily.md`'s Open list. Loyalty tier
progress is now real (migration `0034`, above). Remaining known-mock
surface: rewards catalog/redemption (no table) — check `daily.md` for
current status.
When adding anything new:
shared brand tokens, `useTranslations`/`getTranslations` with both
message files updated together, Base UI's `render` prop for polymorphic
Buttons, "disabled + tooltip" for unbacked actions, DI'd query-layer
modules, guest-safe RPCs for anything a logged-out user needs to touch.
