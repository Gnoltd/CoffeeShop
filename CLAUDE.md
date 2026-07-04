# CLAUDE.md

Structural map of the Coffee Shop app. This repo currently contains **structure only** —
folders and files exist with one-line comments describing their purpose; no working
code, dependencies, or tests have been added yet. Full rationale lives in
`docs/superpowers/specs/2026-07-04-coffee-shop-app-design.md`. A full TDD implementation
plan (real code, real tests) is already written and waiting at
`docs/superpowers/plans/2026-07-04-coffee-shop-scaffold.md` for when you're ready to build.

## Stack (planned)

Next.js (App Router, TypeScript) + Tailwind + shadcn/ui, talking directly to
Supabase (Postgres + Auth + Realtime) via its SDK. No custom backend server —
Row Level Security (RLS) is the intended access-control boundary. Edge Functions
will handle logic needing secrets or atomicity (payments, order placement).

## Roles (planned)

`profiles.role`: `customer | staff | manager | admin`. Staff = fulfillment
(POS + Kitchen Display). Manager = Staff + menu/inventory/tables/reports.
Admin = Manager + staff accounts/roles + shop/loyalty settings.

## Route map

- `app/(marketing)` — public landing page (`/`)
- `app/(auth)` — `/login`, `/signup`
- `app/(customer)` — `/menu`, `/cart`, `/checkout`, `/orders`, `/orders/[orderId]`,
  `/table/[qrToken]`, `/profile`, `/loyalty`
- `app/staff` — `/staff/pos`, `/staff/orders`
- `app/admin` — `/admin/dashboard`, `/admin/menu`, `/admin/inventory`,
  `/admin/tables`, `/admin/staff` (admin-only), `/admin/settings` (admin-only)

`middleware.ts` will gate `/staff/*` (staff|manager|admin) and `/admin/*`
(manager|admin, with `/admin/staff` and `/admin/settings` further restricted
to admin).

**Note:** `staff` and `admin` are real URL-segment folders (not parenthesized
route groups like `(customer)`) — Next.js route groups are invisible in the
URL, so parenthesized `(staff)`/`(admin)` groups would have collided with
`(customer)`'s bare paths (`/menu`, `/orders`). This was caught and fixed
during planning; see the plan doc for details.

## Database (`supabase/migrations/`)

Files are currently empty placeholders (one comment line each) in intended
apply order: `0001_identity_and_roles` → `0002_shop_config` → `0003_menu` →
`0004_inventory` → `0005_orders` → `0006_payments_and_loyalty` →
`0007_handle_order_paid`. Full entity list: spec Section 2. Full SQL for
every migration already exists in the plan doc's Tasks 3–9.

## Edge Functions (`supabase/functions/`)

`place-order`, `stripe-webhook`, `vnpay-ipn`, `vnpay-return` — each is
currently a single `index.ts` comment stub. Full handler code (with tests)
is in the plan doc's Task 11.

## Building this for real

When ready to move past structure, follow
`docs/superpowers/plans/2026-07-04-coffee-shop-scaffold.md` task by task
(via the `superpowers:executing-plans` or `superpowers:subagent-driven-development`
skill) — it has complete, tested code for every file listed above.
