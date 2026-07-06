# Today: Real Orders + Realtime shipped (3rd "make all data real-time" sub-project)

## Task

Continued the "make all data real-time" project (Inventory → Tables →
**Orders** → Staff accounts). This session shipped Orders core (Cash
payment only — Stripe/VNPay explicitly deferred to their own follow-up
specs, per the sequencing agreed at the start of this sub-project).

## Done today (recap: Inventory and Tables shipped earlier today too)

Full detail for Inventory and Tables is in CLAUDE.md's "Admin pages" and
"Table identity flow" sections. Summary: both got real Supabase data +
Realtime, replacing `localStorage`/in-memory mocks, following the same
spec → plan → inline-execution → live-verification cycle used for
Orders below.

### Real Orders + Realtime (core, Cash-only) — shipped, third sub-project

Spec: `docs/superpowers/specs/2026-07-06-orders-realtime-design.md`.
Plan: `docs/superpowers/plans/2026-07-06-orders-realtime.md` (11 tasks +
4 real bugs found and fixed during live verification, executed inline
on `main`).

- **Big discovery, same pattern as every prior sub-project**: `orders`/
  `order_items`/`order_item_modifiers` (migration `0005_orders.sql`) and
  the inventory-deduction trigger (`0007_handle_order_paid.sql`) already
  existed, fully correct, waiting for real orders to exist.
- **A real security correction made during design, before any code was
  written**: the approved brainstorming answer ("public read for guest
  orders by ID") was refined during spec-writing into a narrowly-scoped
  `get_order_for_tracking` RPC instead of a broad RLS policy, once it
  became clear a `customer_id is null` SELECT policy would let any guest
  bulk-read every other guest's order — RLS gates by row predicate, not
  by "did you ask for this specific id."
- **A real SQL bug caught in plan self-review, before implementation**:
  the `place_order` function reused a `jsonb`-typed loop variable
  against a typed temp-table row with `->>` JSON accessors — invalid
  syntax, fixed with a proper `record` variable before ever running it.
- **A missing `order_items.note` column caught in the same self-review**:
  the real schema had nowhere to store a customer's free-text per-item
  note (an already-shipped Cart/Checkout feature) — added the column so
  `place_order` doesn't silently drop it.
- **Four more real bugs found only by testing through the actual
  browser/UI, invisible to curl or direct SQL testing**:
  1. `orders.pickup_time` is `timestamptz`, not `text` — the UI's
     semantic tokens (`"asap"`/`"15"`/`"30"`/`"schedule"`) needed
     server-side conversion. Found on the very first `place_order` test
     call.
  2. The `place-order` Edge Function had no CORS handling at all — curl
     never sends a preflight `OPTIONS` request, so this was completely
     invisible until Playwright drove a real browser through Checkout.
  3. `supabase.functions.invoke()` always attaches *some*
     `Authorization` header, even for a guest (the client's own
     publishable key, not a JWT) — forwarding it blindly broke
     `auth.uid()` resolution. Fixed by only forwarding JWT-shaped
     tokens.
  4. **Migration `0014` never added `orders` to the
     `supabase_realtime` publication** (unlike Inventory's/Tables'
     migrations, which each did this themselves) — neither customer
     tracking nor Kitchen Display received any live update at all.
     Migration `0015` fixed it.
  5. `order-tracking.tsx`'s single-order Realtime subscription used a
     `filter: 'id=eq.X'` clause, which doesn't reliably combine with
     RLS-gated `postgres_changes` — confirmed directly with a
     `supabase-js` script that an identical unfiltered subscription
     received events fine while the filtered one received nothing.
     Fixed by filtering client-side on the delivered payload instead.
- Both fixes (4) and (5) were then **re-verified live** with two-tab
  Playwright tests (one tab watching, a direct SQL `update` from this
  session, confirming the open tab updates without any reload) — proving
  the fix, not just the absence of an error.
- Full real flow verified end-to-end multiple times: guest places a Cash
  order (Stripe/VNPay confirmed disabled+tooltip) → Order Tracking shows
  "Awaiting Payment" + a guest-polling note → staff confirms cash
  received in POS's new Awaiting Payment list → guest's tracking page
  picks it up via polling → staff advances `preparing → ready →
  completed` on Kitchen Display → guest's tracking page reaches
  "Completed", all via polling. Separately verified: a POS walk-in Cash
  sale lands directly in KDS "New" with no Awaiting Payment step
  (payment already collected at the counter); a logged-in customer's
  loyalty-point redemption correctly deducts their real balance and
  inserts a `loyalty_transactions` row; a logged-in customer's tracking
  page updates via true Realtime (not polling).
- `supabase/functions/place-order` gaining real code (previously a
  single comment line) surfaced that the root `tsconfig.json` had been
  silently type-checking Deno Edge Function files against the main
  Next.js project's compiler options the whole time — fixed by
  excluding `supabase/functions` from the main tsconfig.
- ESLint baseline: 6 pre-existing errors (5 from before today + 1 new,
  in `useKitchenOrders.tsx`'s initial-fetch effect — same legitimate
  pattern class as the others).
- All test data (orders, loyalty transactions, redeemed points) cleaned
  up after verification; test customer's loyalty balance restored to 0.

## Next session starts here

1. **Sub-project #4: Staff accounts** — `components/admin/staff-accounts.tsx`'s
   local mock array → real `profiles` queries (role management,
   activate/deactivate), matching RLS to the existing
   `on_profile_role_change` trigger. This finishes the "make all data
   real-time" initiative's originally-scoped four sub-projects.
2. **Or: the Stripe follow-up spec to Orders** — real Stripe
   Checkout/PaymentIntent integration + webhook, wrapping around the
   already-built `place_order` RPC (shaped for exactly this). VNPay
   would follow as its own spec after that. Both are valid next steps
   per the sequencing agreed when Orders started — ask which one before
   assuming.
3. Two throwaway test accounts (staff/customer roles) exist in the live
   Supabase project — credentials in `.env.local` and the gitignored
   `test-accounts.md` at the repo root.
4. Known gap, documented not hidden: `checkout-view.tsx`'s `orderType`
   state only reads `activeTable` once at first render — can default to
   "pickup" even when `activeTable` becomes populated moments later
   after a full reload. Predates this session's work (identical pattern
   existed in the old mock hook); a small follow-up whenever Checkout is
   next revisited.
5. `next build` still prints the "middleware deprecated, use proxy"
   warning (Next.js 16.2.10). Not urgent.
