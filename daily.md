# Today: Staff Accounts + Realtime shipped (4th and final "make all data real-time" sub-project)

## Task

Finished the "make all data real-time" initiative (Inventory → Tables →
Orders → **Staff accounts**). This session shipped Staff accounts: real
Supabase Auth account creation, an `is_active` disable mechanism, and a
real staff directory with Realtime, replacing Admin Staff's local mock
array. All four originally-scoped sub-projects are now complete.

## Done today

Spec: `docs/superpowers/specs/2026-07-06-staff-accounts-realtime-design.md`.
Plan: `docs/superpowers/plans/2026-07-06-staff-accounts-realtime.md` (6
tasks, executed inline on `main`). Full detail in CLAUDE.md's "Staff
accounts + Realtime" section.

- **`is_active` disable mechanism, not Auth banning** — migration `0016`
  adds `profiles.is_active` and changes `current_user_role()` to
  downgrade a disabled account to `'customer'` instead of banning/
  locking their Supabase Auth login. A disabled employee keeps ordinary
  customer access, matching a real disabled employee not being locked
  out of visiting as a customer.
- **`get_staff_members()`** (migration `0016`) — the only controlled
  read path joining `auth.users.email` into a staff directory (protected
  schema, no client-facing email column on `profiles`).
- **`create-staff-account` Edge Function** — real Supabase Auth account
  creation via the Admin API (`email_confirm: true`, no confirmation
  email sent — sidesteps this project's known email rate limit), returns
  a one-time generated password shown once in Admin Staff's UI.
- **A real bug found only by testing end-to-end, not guessed**: the
  Edge Function's service-role client bypasses RLS but not the
  `on_profile_role_change` trigger — triggers fire regardless of RLS
  bypass, and the trigger's own `current_user_role()` check resolves
  `auth.uid()` as null for a service-role connection with no forwarded
  JWT, so it rejected the very first role assignment on a brand-new
  account. Fixed with migration `0017`'s `set_initial_staff_role()`, a
  `service_role`-only RPC using `session_replication_role` to skip
  triggers for that one `UPDATE`.
- **A real bug found in three files that bypass `current_user_role()`
  entirely** — `middleware.ts`, `lib/get-current-role.ts` (found
  auditing every role-read call site before writing the plan), and
  `components/auth/login-form.tsx` (missed in that first audit, caught
  during live verification) all read `profiles.role` directly instead
  of through the SQL function, so none of them respected `is_active`
  without a direct fix. All three now check `is_active` and downgrade
  to `"customer"` when false.
- `lib/supabase/staff-data.ts` — query layer (`getStaffMembers`,
  `updateStaffMember`, `createStaffAccount`), TDD with 4 passing tests.
- `components/admin/staff-accounts.tsx` + `staff-member-form.tsx` —
  real data + unfiltered Realtime subscription on `profiles`, a
  one-time-password display panel, email locked after creation, and the
  logged-in admin's own row has its disable toggle disabled (can't lock
  yourself out).
- Full local pipeline green: `tsc --noEmit`, `vitest run` (45 tests),
  `eslint` (7 pre-existing baseline errors, no new categories — same
  recurring "setState in effect" pattern that already exists in
  `useCart.tsx`/`useKitchenOrders.tsx`/`useTables.tsx`/
  `menu-management.tsx`), `npm run build`.
- Verified live end-to-end with Playwright against the real Vercel
  deployment: created a real throwaway account, logged into it from a
  fresh browser context and confirmed it landed on `/staff/pos`,
  confirmed Realtime showed the new row on a second admin tab with no
  reload, disabled it and confirmed the still-logged-in session lost
  staff access on its very next request (no stale-session risk) with the
  role badge switching to guest/customer styling, re-enabled it and
  confirmed access came back with no re-login, and confirmed the real
  admin's own row has a disabled lock button. Cleaned up the throwaway
  account; confirmed the real admin's `is_active` was never touched.
- Auto-mode correctly blocked two attempts to write real credentials to
  disk during this session (a Playwright debug script hardcoding the
  live admin password, twice) — both times fixed by switching to
  env-var-based credential passing instead of working around the block.

## Next session starts here

**All four "make all data real-time" sub-projects (Inventory, Tables,
Orders, Staff accounts) are now shipped.** The only deliberately
deferred backend work left is Stripe/VNPay integration (their own two
follow-up specs to the Orders work — Checkout's Card/VNPay buttons are
still disabled+tooltip, only Cash is real end-to-end).

1. **Ask the user what's next** — don't assume. Likely candidates:
   - The Stripe follow-up spec (real Checkout/PaymentIntent + webhook,
     wrapping the already-built `place_order` RPC).
   - The VNPay follow-up spec (would come after Stripe, per the
     sequencing agreed when Orders started).
   - Something else entirely — the core "make all data real-time"
     initiative that's been running all session is now complete.
2. Two throwaway test accounts (staff/customer roles) exist in the live
   Supabase project — credentials in `.env.local` and the gitignored
   `test-accounts.md` at the repo root.
3. Known gap, documented not hidden: `checkout-view.tsx`'s `orderType`
   state only reads `activeTable` once at first render — can default to
   "pickup" even when `activeTable` becomes populated moments later
   after a full reload. Predates this session; a small follow-up
   whenever Checkout is next revisited.
4. `next build` still prints the "middleware deprecated, use proxy"
   warning (Next.js 16.2.10). Not urgent.
