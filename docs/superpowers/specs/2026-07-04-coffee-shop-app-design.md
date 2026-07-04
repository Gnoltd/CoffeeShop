# Coffee Shop Management & Customer Portal — Structural Design

**Date:** 2026-07-04
**Status:** Approved (structure only — visual/UI design deferred to a later phase)

## Overview

A single web application serving three audiences for a single-location coffee shop:

- **Customers** — browse menu, order ahead for pickup or order at the table (dine-in via QR), pay online or in person, track order status live, earn/redeem loyalty points.
- **Staff** — run a POS for in-person orders, work a live Kitchen Display queue.
- **Manager** — everything Staff can do, plus menu, inventory, tables, and sales reporting.
- **Admin** — everything Manager can do, plus staff account/role management and shop/loyalty settings.

This document defines structure only (architecture, schema, API surface, folder layout, feature lists). Visual/UI design is a separate, later phase.

## Scope

- Single shop location (no multi-branch support; see "Explicitly out of scope").
- Order types: pickup (order-ahead) and dine-in (QR-code table ordering). No delivery.
- Payments: Stripe (card), Cash (pay at counter), VNPay (QR/bank transfer) — all sandbox/test mode for now.
- Loyalty: points-based, with admin-configurable earn and redemption rates (default: 10,000 VND spent = 1 point; 100 points = 10,000 VND discount).
- Full menu customization: sizes and modifier groups/modifiers per item.
- Ingredient-level inventory tracking with recipe (BOM) linkage to menu items and modifiers.
- Roles: `customer`, `staff`, `manager`, `admin`.
- Real-time features: live order status tracking (customer-facing) and a live Kitchen Display queue (staff-facing), via Supabase Realtime.
- In-app notifications only (no email/SMS in this phase).
- Auth: email/password + Google OAuth via Supabase Auth.
- Deployment target: Vercel (frontend) + Supabase (backend/data).

## Explicitly Out of Scope (for this phase)

- Multiple branches/locations.
- Delivery order type and courier tracking.
- Email/SMS notifications.
- A separate rewards catalog (redemption is a flat configurable rate, not discrete reward tiers).
- Staff scheduling/shifts.
- Visual/UI design system, color palette, component styling — structure only in this document.

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router), React |
| Styling/UI | Tailwind CSS + shadcn/ui |
| Backend | Supabase (BaaS) — no custom Express/API server |
| Database | Supabase Postgres |
| Auth | Supabase Auth (email/password + Google OAuth) |
| Realtime | Supabase Realtime (Postgres change subscriptions) |
| Custom server logic | Supabase Edge Functions |
| Payments | Stripe (card, sandbox), VNPay (QR/bank, sandbox), Cash (manual) |
| Deployment | Vercel (frontend), Supabase (managed backend) |

**Why Supabase-only:** Postgres Row Level Security (RLS) enforces role-based access directly at the database layer, so the Next.js app can talk to Supabase directly via its SDK for all standard CRUD without a hand-rolled REST API. Edge Functions cover the handful of operations that need secrets or atomicity (payment webhooks, order placement). This minimizes infrastructure for a single-location app while still providing a real security boundary.

---

## 1. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Next.js App (Vercel)                 │
│                                                           │
│  Route groups (role-separated, middleware-protected):    │
│   (customer)   (staff)   (admin)   (auth)   (public)     │
│                                                           │
│  Shared: UI components (shadcn/ui), Supabase client,     │
│  hooks, types                                            │
└───────────────┬───────────────────────────┬─────────────┘
                │                           │
      Supabase client SDK          Realtime subscriptions
      (auth, CRUD via              (order status, KDS queue,
       PostgREST, RLS-checked)      low-stock alerts)
                │                           │
                ▼                           ▼
┌─────────────────────────────────────────────────────────┐
│                        Supabase                          │
│                                                           │
│  ┌───────────┐ ┌────────────┐ ┌──────────────────────┐  │
│  │  Auth      │ │  Postgres  │ │  Edge Functions       │  │
│  │ (email/pw, │ │  + RLS     │ │  - place-order         │  │
│  │  Google)   │ │  policies  │ │  - stripe-webhook      │  │
│  │            │ │            │ │  - vnpay-ipn            │  │
│  │            │ │            │ │  - vnpay-return         │  │
│  └───────────┘ └────────────┘ └──────────────────────┘  │
│                                                           │
│  Storage (menu item images, avatars)                     │
└───────────────────────┬───────────────────────────────┘
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
        ┌──────────┐       ┌───────────┐
        │  Stripe   │       │  VNPay     │
        │ (sandbox) │       │ (sandbox)  │
        └──────────┘       └───────────┘
```

**Key architectural decisions:**

- **No custom backend server.** The Next.js app talks directly to Supabase via its SDK for all reads/writes. Security is enforced at the database layer via Row Level Security (RLS) policies keyed off the user's role, not by an API layer.
- **Edge Functions** exist only for logic that must run server-side with secrets (Stripe/VNPay webhook signature verification, VNPay hash signing) or that must be atomic/trusted (order creation with server-computed pricing, stock validation, loyalty redemption). Everything else goes through Supabase's auto-generated API directly.
- **Realtime** (Postgres change subscriptions) powers the live Kitchen Display queue, the customer's live order-status tracker, and low-stock alerts — no polling.
- **Role model:** every authenticated user has a row in `profiles` with a `role` enum: `customer | staff | manager | admin`. Middleware in Next.js reads this role from the session and gates access to `(staff)`/`(admin)` route groups; RLS policies enforce the same rule at the database level as the actual security boundary (middleware is UX convenience, not the security guarantee).
- **Single location:** no `branches` table. Shop-wide info lives in a single-row `shop_settings` config table.

---

## 2. Database Schema (Core Entities & Relationships)

**Identity & Roles**
- `profiles` — `id` (FK → `auth.users.id`), `full_name`, `phone`, `avatar_url`, `role` (`customer` \| `staff` \| `manager` \| `admin`), `loyalty_points_balance`, `created_at`

**Shop Config**
- `shop_settings` — single-row config: `shop_name`, `address`, `phone`, `opening_hours`, `tax_rate`
- `loyalty_settings` — single-row config: `earn_rate_vnd_per_point` (default 10,000), `redeem_value_vnd_per_point` (default 100)

**Menu**
- `categories` — `id`, `name`, `sort_order`
- `menu_items` — `id`, `category_id` (FK), `name`, `description`, `base_price`, `image_url`, `is_available`
- `menu_item_sizes` — `id`, `menu_item_id` (FK), `name` (S/M/L), `price_delta`
- `modifier_groups` — `id`, `name` (e.g. "Milk Options", "Add-ons"), `is_required`, `max_selections` — reusable across items
- `modifiers` — `id`, `modifier_group_id` (FK), `name`, `price_delta`
- `menu_item_modifier_groups` — join table: `menu_item_id` (FK) ↔ `modifier_group_id` (FK), letting groups be reused across many items

**Inventory**
- `ingredients` — `id`, `name`, `unit` (ml/g/pcs), `stock_quantity`, `low_stock_threshold`
- `menu_item_ingredients` — recipe/BOM: `menu_item_id` (FK), `ingredient_id` (FK), `quantity_used`
- `modifier_ingredients` — BOM for add-ons: `modifier_id` (FK), `ingredient_id` (FK), `quantity_used`
- `inventory_logs` — audit trail: `id`, `ingredient_id` (FK), `change_quantity`, `reason` (`order_deduction` \| `restock` \| `adjustment` \| `waste`), `reference_order_id` (FK, nullable), `created_by` (FK → profiles, nullable), `created_at`

**Dine-in**
- `tables` — `id`, `table_number`, `qr_code_token`

**Orders**
- `orders` — `id`, `customer_id` (FK → profiles), `order_type` (`pickup` \| `dine_in`), `table_id` (FK, nullable), `status` (`pending_payment` \| `paid` \| `preparing` \| `ready` \| `completed` \| `cancelled`), `payment_method` (`stripe` \| `cash` \| `vnpay`), `payment_status`, `subtotal`, `discount_amount`, `loyalty_points_used`, `loyalty_points_earned`, `total`, `pickup_time`, `created_at`, `updated_at`
- `order_items` — `id`, `order_id` (FK), `menu_item_id` (FK), `size_id` (FK, nullable), `quantity`, `unit_price`, `subtotal`
- `order_item_modifiers` — `order_item_id` (FK), `modifier_id` (FK), `price_delta`

**Payments & Loyalty**
- `payment_transactions` — `id`, `order_id` (FK), `provider` (`stripe` \| `vnpay` \| `cash`), `provider_transaction_id`, `amount`, `status`, `raw_response` (jsonb), `created_at`
- `loyalty_transactions` — `id`, `customer_id` (FK → profiles), `order_id` (FK, nullable), `points_change`, `type` (`earn` \| `redeem` \| `adjust`), `created_at`

**Key relationships:** one customer → many orders; one order → many order_items → many order_item_modifiers. Both `menu_items` and `modifiers` declare ingredient consumption (BOM), so any paid order triggers `inventory_logs` deductions. Every points-affecting event writes a `loyalty_transactions` row; `profiles.loyalty_points_balance` is a running total maintained by that ledger (source of truth = ledger, balance = cache).

---

## 3. Backend API Structure (Supabase: RLS + Auto-API + Edge Functions + Realtime)

There is no custom REST layer. The "API" is three things working together:

**a) Auto-generated REST API (PostgREST via Supabase SDK)** — used for all standard reads/writes, secured by RLS:

| Table group | Customer | Staff | Manager | Admin |
|---|---|---|---|---|
| `profiles` (own row) | SELECT/UPDATE own | SELECT/UPDATE own | SELECT/UPDATE own | SELECT/UPDATE own |
| `profiles` (others) | — | SELECT all | SELECT all | SELECT/UPDATE all (role changes) |
| Menu tables (`categories`, `menu_items`, `menu_item_sizes`, `modifier_groups`, `modifiers`, `menu_item_modifier_groups`) | SELECT (public) | SELECT | full | full |
| Inventory (`ingredients`, `menu_item_ingredients`, `modifier_ingredients`, `inventory_logs`) | — | SELECT | full | full |
| `orders`, `order_items`, `order_item_modifiers` (own) | SELECT/INSERT own | SELECT/UPDATE all (status) | full | full |
| `orders` (all) | — | SELECT all, UPDATE status | full | full |
| `loyalty_transactions` (own) | SELECT own | SELECT all | full | full |
| `loyalty_settings`, `shop_settings` | SELECT (public) | SELECT | UPDATE | UPDATE |
| `tables` | SELECT (public, for QR) | SELECT | full | full |

**b) Edge Functions** (server-side logic requiring secrets or atomicity):

| Function | Trigger | Purpose |
|---|---|---|
| `place-order` | Customer or staff submits a cart | Recomputes prices server-side from the DB (never trusts client-sent prices), validates stock availability, applies loyalty point redemption, creates `orders` + `order_items` + `order_item_modifiers` atomically. For `stripe`: also creates a PaymentIntent and returns `client_secret`. For `vnpay`: generates a signed payment URL and returns it. For `cash`: returns order confirmation directly. |
| `stripe-webhook` | Stripe calls on payment event | Verifies signature, flips `orders.payment_status` → `paid` on success |
| `vnpay-ipn` | VNPay server-to-server callback | Verifies secure hash, flips `orders.payment_status` → `paid` |
| `vnpay-return` | Browser redirect after VNPay checkout | Verifies hash, redirects customer to the order tracking page with the result |

**c) Postgres trigger (centralized "order paid" logic)** — rather than duplicating inventory-deduction and loyalty-earning logic across three payment paths, a single DB trigger `handle_order_paid()` fires whenever `orders.payment_status` transitions to `paid` (whether flipped by `stripe-webhook`, `vnpay-ipn`, or a staff manual cash update). It deducts ingredient stock per the order's BOM, writes `inventory_logs`, calculates points earned, and writes a `loyalty_transactions` row while updating `profiles.loyalty_points_balance`. This keeps all three payment methods consistent by construction.

**d) Realtime subscriptions:**
- `orders` filtered by `customer_id = current user` → customer's live order-status tracker
- `orders` filtered by `status IN (preparing, ready)` → staff Kitchen Display queue
- `ingredients` filtered by `stock_quantity < low_stock_threshold` → manager/admin low-stock alerts

---

## 4. Frontend Folder Structure & Core Pages

```
coffee-shop/
├── app/
│   ├── (public)/                    # no auth required
│   │   ├── layout.tsx
│   │   ├── page.tsx                 # landing page
│   │   └── menu/page.tsx            # public menu browse (view-only)
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (customer)/                  # role: customer — middleware-protected
│   │   ├── layout.tsx               # customer shell/nav
│   │   ├── menu/page.tsx            # browse + add to cart
│   │   ├── cart/page.tsx
│   │   ├── checkout/page.tsx        # payment method selection, calls place-order
│   │   ├── orders/page.tsx          # order history
│   │   ├── orders/[orderId]/page.tsx    # live order tracking (Realtime)
│   │   ├── table/[qrToken]/page.tsx     # dine-in QR landing → starts table order
│   │   ├── profile/page.tsx
│   │   └── loyalty/page.tsx         # points balance & history
│   ├── (staff)/                     # role: staff, manager, admin
│   │   ├── layout.tsx
│   │   ├── pos/page.tsx             # POS: build order in-person
│   │   └── orders/page.tsx          # live Kitchen Display queue (Realtime)
│   ├── (admin)/                     # role: manager, admin (some pages admin-only)
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx       # sales overview/reports
│   │   ├── menu/page.tsx            # manage categories/items/modifiers
│   │   ├── inventory/page.tsx       # ingredient stock + logs
│   │   ├── tables/page.tsx          # manage dine-in tables/QR codes
│   │   ├── staff/page.tsx           # manage staff accounts & roles (admin-only)
│   │   └── settings/page.tsx        # shop_settings, loyalty_settings (admin-only)
│   ├── layout.tsx                   # root layout
│   └── middleware.ts                # reads role from session, gates route groups
├── components/
│   ├── ui/                          # shadcn/ui primitives
│   └── customer/ staff/ admin/ shared/
├── lib/
│   ├── supabase/ (client.ts, server.ts, middleware.ts)
│   ├── stripe.ts
│   ├── vnpay.ts
│   └── utils.ts
├── hooks/
│   ├── useCart.ts
│   ├── useRealtimeOrders.ts
│   └── useAuth.ts
├── types/
│   └── database.types.ts            # generated from Supabase schema
├── supabase/
│   ├── migrations/                  # SQL schema migrations
│   └── functions/                   # Edge Functions: place-order, stripe-webhook, vnpay-ipn, vnpay-return
├── CLAUDE.md                        # structural map (folders, schema, conventions)
├── continuity.md                    # project memory (goals, decisions, status, next steps)
├── daily.md                         # current session's task focus
└── (config: next.config.ts, tailwind.config.ts, package.json, .env.local.example)
```

**Notes:**
- Route groups map directly to the RLS-backed roles from Section 3; `middleware.ts` is the UX gate, RLS is the real security boundary.
- `(staff)` and `(admin)` overlap in permissions (manager/admin can also use POS) — a manager sees both `(staff)` and `(admin)` nav sections; within `(admin)`, `staff/` and `settings/` pages do an additional in-page check to restrict to `admin` only.

---

## 5. Customer Features (Flow, Menu, Ordering, Profile)

**User flow:**
```
Landing/Menu (public browse, no login needed)
   → Sign up / Log in (email+pw or Google)
   → Choose order type: Pickup or Dine-in (scan table QR)
   → Browse menu → select item → choose size + modifiers → add to cart
   → Cart review → apply loyalty points (optional) → Checkout
   → Choose payment: Stripe / Cash / VNPay → place-order
   → Order confirmation → Live order tracking (Realtime status)
   → Pickup/receive at table → order marked completed
   → Order appears in history; loyalty points earned reflected in profile
```

**Core pages & behavior:**
- **Menu browsing** — categorized list, item detail with size/modifier selection and live price calculation, respects `is_available`.
- **Cart** — persisted client-side until checkout; shows itemized modifiers and running total.
- **Checkout** — order type confirmation (pickup time picker, or pre-filled table from QR scan), optional loyalty point redemption (shows max redeemable given balance and order total, using `loyalty_settings.redeem_value_vnd_per_point`), payment method selection.
- **Order tracking** (`/orders/[orderId]`) — Realtime-subscribed status timeline (Pending → Paid → Preparing → Ready → Completed).
- **Order history** — past orders, reorder shortcut.
- **Profile** — name/phone/avatar edit. No saved addresses (pickup/dine-in only, no delivery).
- **Loyalty page** — current points balance, earn/redeem transaction history, current admin-set rates shown for transparency.
- **Dine-in QR flow** — scanning a table's QR opens `/table/[qrToken]`, which validates the token against `tables`, pins `order_type=dine_in` and `table_id` for the session, then drops into the menu.

---

## 6. Staff/Manager Features

**Staff (POS + Kitchen Display):**
- **POS (`/pos`)** — staff builds an order in-person on behalf of a walk-in customer: select items → size/modifiers → cart → payment method → `place-order`. Supports both pickup and dine-in (table selection) order types.
- **Kitchen Display / Live Order Queue (`/orders`)** — Realtime board of all active orders as status columns (Paid → Preparing → Ready), staff taps to advance status or cancel with a reason.
- **Order lookup** — search/filter past orders (by customer, date, status).

**Manager (adds operational management on top of Staff):**
- **Menu management (`/admin/menu`)** — CRUD categories, menu items, sizes, modifier groups/modifiers, link ingredients (BOM) per item/modifier, toggle item availability.
- **Inventory management (`/admin/inventory`)** — view stock levels per ingredient, manually restock (writes `inventory_logs` with reason `restock`), view low-stock alerts, view full inventory audit log.
- **Tables management (`/admin/tables`)** — create/edit dine-in tables, generate/regenerate QR tokens.
- **Dashboard (`/admin/dashboard`)** — sales overview: revenue and order-count over a date range, best-selling items, basic loyalty program stats.

**Admin (superset — adds account/system control):**
- **Staff account management (`/admin/staff`, admin-only)** — create staff/manager accounts, assign/change roles, deactivate accounts.
- **Settings (`/admin/settings`, admin-only)** — edit `shop_settings` and `loyalty_settings`.

**Role boundary summary:** Staff = fulfillment only (POS + Kitchen Display). Manager = Staff + menu/inventory/tables/reports. Admin = Manager + staff accounts/roles + shop/loyalty settings.

---

## Documentation & Tracking Files

Three root-level docs serve distinct, non-overlapping purposes:

- **`CLAUDE.md`** — static structural map: folder layout, schema summary, role/RLS model, conventions. Written once the scaffold exists; updated only when structure changes.
- **`continuity.md`** — persistent project memory across sessions: goals, current phase/status, key decisions and why, completed work, next steps/blockers, key business context (e.g. loyalty rates, single-location constraint). Updated at the end of each work session.
- **`daily.md`** — scoped to the current session only: today's task, relevant files, constraints, "done when" criteria. Overwritten each new session.

These are created as part of the initial scaffold (implementation phase), populated as work progresses — not designed in detail here.

## Next Steps

This spec covers structure only. Follow-up phases (not covered here):
1. Implementation plan (via writing-plans skill) to scaffold the project per this structure.
2. Visual/UI design pass (colors, typography, component styling) — deferred per user request.
