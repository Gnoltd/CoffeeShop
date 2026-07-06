# Real Staff Accounts + Realtime — Design Spec

**Date:** 2026-07-06
**Status:** Approved, ready for implementation planning.

## Context

Fourth and final sub-project of the "make all data real-time" initiative
(decomposition: Inventory → Tables → Orders → **Staff accounts**).
Replaces `components/admin/staff-accounts.tsx`'s local mock array
(`INITIAL_STAFF`) with real Supabase data and Realtime, following the
same shape as the three prior sub-projects.

### What already exists (migration `0001_identity_and_roles.sql`, applied)

- `public.profiles` — `id` (FK into `auth.users(id)`, `on delete
  cascade`), `full_name`, `phone`, `avatar_url`, `role` (`user_role` enum:
  `customer | staff | manager | admin`), `loyalty_points_balance`,
  `created_at`. RLS: `profiles_select_own` (anyone reads their own),
  `profiles_select_staff` (staff/manager/admin read *every* profile —
  already sufficient for a staff list), `profiles_update_own` (a user
  updates their own row), `profiles_update_admin` (an admin updates *any*
  row). The `on_profile_role_change` trigger already blocks a non-admin
  from changing any `role` column, including their own.
- `public.current_user_role()` — `security definer`, `select role from
  profiles where id = auth.uid()`. Already the single source of truth
  every RLS policy and `middleware.ts` reads role from.
- `public.handle_new_user()` — a trigger on `auth.users` insert that
  auto-creates the matching `profiles` row. This is the **only** way a
  `profiles` row is ever created — there is no direct insert policy, and
  none is needed, because of what this implies for account creation
  (below).

### What's missing (the actual gap — bigger than the prior three sub-projects)

1. **A new staff account needs a real, login-capable Supabase Auth
   user, not just a table row.** Because `profiles.id` is a foreign key
   into `auth.users(id)` and rows are only ever created via the
   `handle_new_user` trigger, "Add Staff" cannot be a plain `profiles`
   insert (there's no policy for it, and even if there were, it would
   create an orphaned row with no way to ever log in). Real creation
   needs the Auth Admin API (`auth.admin.createUser()`), which needs the
   service-role key — an Edge Function, same shape as `place-order`.
2. **No `active`/`disabled` concept exists in the schema at all.**
3. **No `email` column exists on `profiles`**, and there is no
   `email`-reading path exposed to the client — `auth.users` is a
   protected schema, not queryable via PostgREST/the client SDK. Any
   "Staff Accounts" list needs email, so this needs its own controlled
   read path.

## Scope

One implementation plan. Every piece (migration → Edge Function → query
layer → hook rewrite → Admin UI) depends on the schema/function/Edge
Function existing first, not independent subsystems.

**In scope:** the `is_active` column and its effect on
`current_user_role()`; the `get_staff_members()` read function; the
`create-staff-account` Edge Function (admin-only, one-time-password
account creation); Realtime; the Admin Staff Accounts page's Add/Edit
flows and stat cards becoming real.

**Out of scope:** changing a staff member's email after creation
(would need its own Admin API call — `auth.admin.updateUserById()` — for
a field this app's own mock UI never made editable either); actually
banning the Auth account on disable (this spec revokes role-based access
via `current_user_role()` instead, a lighter, equally effective
mechanism — see the design decision below); a self-service "staff
profile" page (out of scope, matches how customer Profile already
exists separately and isn't touched here).

## Architecture

### 1. Migration — `is_active` column, `current_user_role()` update, `get_staff_members()`, Realtime

- `alter table public.profiles add column is_active boolean not null
  default true;` — applies to every profile (customers included; the
  column is simply never toggled for them, no special-casing needed).
- `current_user_role()` becomes:
  ```sql
  select case when is_active then role else 'customer' end
  from public.profiles where id = auth.uid();
  ```
  One function change cascades correctly everywhere role is already
  checked — every RLS policy, `middleware.ts`'s role gate, the Kitchen
  Display/POS/Admin gates — without touching any of those call sites.
  A disabled staff member keeps their login and can still use the app as
  an ordinary customer (mirrors how a real disabled employee isn't
  banned from ever visiting as a customer); they simply stop passing any
  `staff|manager|admin` check the moment they're disabled.
- **`get_staff_members()`** — `security definer`, `set search_path =
  public`. Internally checks the caller is `staff|manager|admin` (via
  `current_user_role()`) before returning anything — the same
  authorization `profiles_select_staff` already expresses, re-checked
  here because this function needs to join against the protected `auth`
  schema, which RLS on `public.profiles` alone can't do. Returns
  `id, full_name, phone, role, is_active, email` for every profile whose
  `role <> 'customer'`, joined from `auth.users.email`. This is the
  *only* place `auth.users` is ever read from the app, and only for
  already-staff-authorized callers.
- `alter publication supabase_realtime add table public.profiles;` — the
  publication addition every prior sub-project's migration needed to
  remember (the Orders sub-project found this the hard way when it was
  missed).

### 2. New `create-staff-account` Edge Function

Mirrors `place-order`'s shape (thin wrapper, service-role client,
correct CORS handling — both were real bugs found and fixed in the
Orders sub-project, so this function starts with the OPTIONS handler and
`Access-Control-Allow-Origin` header already in place, not rediscovered).

1. Reads the caller's JWT, re-verifies (via a query against `profiles`
   using the service-role client, since RLS doesn't apply to that
   client) that the caller is an **active** `admin` — this function
   bypasses RLS for its own writes, so it is the authorization boundary,
   not `profiles_update_admin`. Rejects with 403 otherwise.
2. Generates a random password (e.g. 16 characters, mixed case +
   digits) — never transmitted anywhere except this one HTTP response.
3. Calls `auth.admin.createUser({ email, password, email_confirm: true,
   user_metadata: { full_name } })` — `email_confirm: true` marks the
   account confirmed immediately with **no confirmation email sent at
   all**, sidestepping this project's already-documented shared-email
   rate limit rather than hitting it again.
4. The `handle_new_user` trigger fires automatically, creating a
   `profiles` row defaulted to `role = 'customer'`. The function then
   updates that row's `role` to the requested value (`staff | manager |
   admin`) using the service-role client (bypasses
   `on_profile_role_change`'s admin-check trigger the same way every
   other `security definer`/service-role path in this app already does
   — the trigger's job is to stop a *client-side* role edit from
   anything but an admin, not to block this already-authorized,
   already-admin-gated server-side path).
5. Returns `{ userId, temporaryPassword }`. The Edge Function is the
   only place this password ever exists in plaintext outside the
   client's one-time display of it.

### 3. Query layer — new `lib/supabase/staff-data.ts`

```ts
export type StaffRole = "staff" | "manager" | "admin"
export type StaffMember = {
  id: string
  fullName: string
  email: string
  phone: string | null
  role: StaffRole
  isActive: boolean
}
export type CreateStaffInput = { fullName: string; email: string; role: StaffRole }

export async function getStaffMembers(supabase): Promise<StaffMember[]>       // via get_staff_members() RPC
export async function updateStaffMember(supabase, id: string, input: { fullName: string; role: StaffRole; isActive: boolean }): Promise<void>  // plain profiles update
export async function createStaffAccount(supabase, input: CreateStaffInput): Promise<{ userId: string; temporaryPassword: string }>  // calls the Edge Function
```

`updateStaffMember` is a **plain table update** — no RPC needed, since
`profiles_update_admin` + the existing `on_profile_role_change` trigger
already correctly gate it end to end (matches how Inventory's/Tables'
plain-field edits needed no RPC either — only atomic/privileged
operations did).

### 4. `components/admin/staff-accounts.tsx` + `staff-member-form.tsx`

- Real Realtime: fetch `getStaffMembers()` once, subscribe **unfiltered**
  to `postgres_changes` on `profiles`, refetch the staff list on any
  change. Unfiltered, not `role=neq.customer`-filtered, for the same
  reason the Orders sub-project's `useKitchenOrders.tsx` subscribes
  unfiltered: a column filter doesn't reliably combine with RLS-gated
  `postgres_changes` (confirmed the hard way in that sub-project) —
  staff already only ever see this list through
  `profiles_select_staff`/`get_staff_members()`'s own authorization, so
  there's no leak risk in subscribing broadly and filtering client-side
  by simply re-calling `getStaffMembers()`.
- **Add Staff**: form collects `fullName`/`email`/`role` (no `active`
  toggle at creation — a brand-new account always starts active).
  Submits to `createStaffAccount`; on success, shows a **"copy this
  password now — it won't be shown again"** confirmation panel with the
  generated password and a copy-to-clipboard button, instead of closing
  the modal immediately.
- **Edit Staff**: form collects `fullName`/`role`/`isActive`. `email` is
  shown but disabled/read-only (changing it is out of scope, per the
  Scope section). The active/disable toggle is **disabled for the
  currently-logged-in admin's own row** — a safety net against
  accidentally revoking your own access with no other admin around to
  undo it.
- Stat cards (Total/Active/Disabled) become real counts over the fetched
  list instead of `INITIAL_STAFF.length`-derived numbers — already
  computed client-side today, just now over real data.

## Data Flow

1. Admin clicks "+ Add Staff", fills the form → `create-staff-account`
   Edge Function verifies the caller is an active admin → creates the
   Auth user (no email sent) → sets its role → returns the temporary
   password → admin sees it once, copies it, relays it to the new hire
   out of band (Slack, in person, etc. — this app has no secure
   in-product delivery channel, an honest limitation stated plainly
   rather than pretending an email would arrive).
2. Admin edits an existing staff member's role/active state → plain
   `profiles` update (RLS + trigger already correctly gate this) →
   Realtime pushes the change to every other open Admin Staff session →
   if the toggled member is logged in elsewhere, their very next
   role-gated request re-resolves `current_user_role()` and sees the
   change immediately (no stale session risk, since role is looked up
   per-request, never cached client-side).

## Error Handling

- `create-staff-account` failing (duplicate email, invalid role, caller
  not an active admin) surfaces as a real inline error in the Add Staff
  form, not a silent failure.
- Realtime subscribe failure degrades to "fetched once, not live" with a
  `console.warn`, matching every other sub-project's convention.
- Disabling the last remaining admin account is **not** specially
  guarded against beyond the self-row toggle-disable safety net — a
  genuinely rare operational mistake an admin could still make against
  a *different* admin's account, accepted as a real but unlikely edge
  case rather than adding a "count remaining admins" check that no other
  part of this app's admin tooling does either.

## Testing

- `lib/supabase/staff-data.test.ts` (same fake-Supabase-client style as
  every other query module): mapping correctness for `getStaffMembers`,
  that `updateStaffMember` issues the right plain `.update(...)` call,
  that `createStaffAccount` calls the Edge Function with the right body
  shape.
- Realtime and the Edge Function's account-creation flow verified live
  via Playwright, same convention as every prior sub-project: create a
  real staff account, confirm the generated password actually logs in,
  confirm the new account's role-gated access works immediately,
  disable it, confirm the disabled account immediately loses
  staff-gated access (redirected like a customer would be) without
  needing to log out first, confirm two open Admin Staff sessions see
  each other's edits live.

## Self-Review Notes

- Checked for placeholders/TBDs — none found.
- Checked internal consistency — the `security invoker`-vs-`security
  definer` reasoning for `get_staff_members()` (definer, because it
  reads the protected `auth` schema) is stated once and not contradicted
  by `updateStaffMember`'s "plain update, no RPC needed" reasoning
  (different operation, different authorization shape — RLS alone
  already covers a same-schema write).
- Checked scope — confirmed email-editing and Auth-account-banning stay
  explicitly out of scope, each with a stated reason rather than a
  silent omission.
