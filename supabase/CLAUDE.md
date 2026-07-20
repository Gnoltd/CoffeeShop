Database and Edge Function detail. Migrated out of the root `CLAUDE.md`
(2026-07-13) so it only loads when working under `supabase/` — see the
root file for cross-cutting conventions and the feature areas that span
multiple directories (payments, table status, deferred-payment
lifecycle, shift closing all touch this directory too, but stay
documented in the root file since they aren't `supabase/`-only).

## Database (`supabase/migrations/`)

43 migrations applied to the live hosted project (`qhiypdqnrnzndxdwqxbx`)
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
| `0024` | fixed `sync_table_occupancy`'s trigger column-scope gap (see gotcha in root `CLAUDE.md`) |
| `0025` | `tables_update_staff` RLS policy (staff-role gap, see gotcha in root `CLAUDE.md`) |
| `0026` | `get_dashboard_stats()` (real Admin Dashboard KPIs) |
| `0027` | `menu_item_reviews` table + review RPCs |
| `0028` | `menu-item-images` public Storage bucket |
| `0029` | `get_order_for_tracking` carries `menuItemId` (needed by reviews) |
| `0030` | `get_order_history()` date filters made null-safe (removed a silent 7-day default) |
| `0031` | `shifts` table + `orders.paid_at` + shift open/report/close RPCs |
| `0032` | `change_order_payment_method()` (Pay Later method correction) |
| `0033` | `menu_item_sizes.sort_order` (admin Sizes editor display order) |
| `0034` | `loyalty_tiers` table + `get_my_loyalty_tier_progress()` (real Loyalty tier progress) |
| `0035` | `rewards`/`reward_redemptions` tables + `redeem_reward()` (real Rewards catalog/redemption) |
| `0036` | `get_shift_history()` (Shift History — list + view past closed shifts) |
| `0037` | Missing FK indexes on menu tables (performance) |
| `0038` | `reward_redemptions.fulfilled_at` + `find_redemption_by_code()`/`fulfill_redemption()` (staff redemption lookup) |
| `0039` | `customer_addresses` table + `set_default_address()` (real Address Book) |
| `0040` | `rewards.discount_value_vnd` + `reward_redemptions.applied_order_id` + `get_redemption_expiry()`/`get_my_redemptions()` + `place_order` gains `redemptionIds` (self-service reward-redemption checkout) |
| `0041` | `find_redemption_by_code()`/`fulfill_redemption()` also treat `applied_order_id` as "used" (staff/checkout consistency) |
| `0042` | `loyalty_settings.enabled` + `orders.tax_amount` + `place_order`/`handle_order_paid`/`get_order_for_tracking` gain real tax + loyalty-enabled enforcement (Admin Settings made real) |
| `0043` | `handle_order_paid` doubles points when paid on a Wednesday (Asia/Ho_Chi_Minh) — makes the Loyalty page's "Double Points Wednesday" banner real |

A real admin account (`admin@phadincoffee.dev`) was bootstrapped via
direct SQL insert into `auth.users` (public signup hits the shared email
rate limit). Two throwaway test accounts (staff/customer roles) also
exist — credentials in `.env.local` and the gitignored `test-accounts.md`.

## Storage buckets

One bucket per distinct upload purpose — never share a bucket across
unrelated content types. Each bucket answers three questions
independently: who can write (RLS on `storage.objects`, same
`current_user_role()` pattern used everywhere else), is it public or
private, and what's actually allowed in it.

- **Every bucket must set `allowed_mime_types`/`file_size_limit` at
  creation** (`storage.buckets` columns, plain `UPDATE`/`INSERT` via
  migration — no dashboard-only step needed). A client-side `accept=`
  attribute or a JS size check (e.g. `menu-item-form.tsx`'s
  `selectFile()`) is UX only — it stops nothing from a direct API call.
  Found and fixed live 2026-07-21 (migration `0050`): `menu-item-images`
  had zero server-side enforcement despite the client claiming
  `image/*` + 5MB, meaning any manager/admin session (the only
  write-capable role) could've uploaded arbitrary content — including
  an HTML/SVG file with embedded script — to a public-read bucket.
- **Public vs private is a one-way content-sensitivity decision, not a
  convenience toggle.** Public (`storage.objects` SELECT policy
  `using (true)`) only for content that's *meant* to be openly served
  with no auth check at all — menu photos, category icons, anything
  already shown on the guest-browsable `/menu`. Anything with real
  sensitivity (a hypothetical customer-uploaded document, a staff file)
  must be a private bucket, a narrow RLS SELECT policy (owner-scoped,
  same shape as `profiles_select_own`), and `createSignedUrl()` for
  time-limited access — never public just to avoid writing that policy.
- **Object key convention**: `${crypto.randomUUID()}-{original filename}`
  (current pattern in `menu-item-form.tsx`) is sufficient — Supabase
  itself restricts stored filenames to a safe character set project-wide,
  so no extra path-traversal sanitization is needed on top of this.

| Bucket | Public | Write role | Allowed MIME types | Size limit |
|---|---|---|---|---|
| `menu-item-images` | yes | manager/admin | `image/jpeg`, `image/png`, `image/webp`, `image/gif` | 5 MB |

When a future feature needs a new upload type (video, a customer-facing
upload, a staff document), start a new bucket with this same
three-question process — don't add it to an existing bucket, and don't
skip the MIME/size restriction "for now."

## Edge Functions (`supabase/functions/`)

All real: `place-order` (routes to Stripe/VNPay/cash based on payload),
`stripe-webhook`, `vnpay-ipn`, `vnpay-return`, `create-staff-account`.
None use an SDK for their respective gateway — raw `fetch`/Web Crypto
throughout, matching this project's dependency-free convention. No Deno
test harness exists in this project — Edge Functions are verified live
(curl smoke tests + real sandbox transactions), not with automated tests.
