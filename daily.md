# Today: Backend is live — migrations applied, admin account created, real auth wired up

## Task

Continued backend setup from the previous session's handoff (this file).
Ran the 7 migrations against the live Supabase project, created a real
admin account, then — per user's choice at the resulting decision point —
wired up real Supabase Auth for Login/Signup/Logout instead of starting on
menu data.

## Done this session

- **Confirmed `mcp__supabase__*` tools work** in this fresh session (the
  prior session's blocker). `list_tables`/`list_migrations` against
  `qhiypdqnrnzndxdwqxbx` both came back empty, confirming a clean slate.
- **Applied all 7 migrations in order** via `mcp__supabase__apply_migration`
  (`0001_identity_and_roles` → `0007_handle_order_paid`). No errors.
  pgcrypto was already installed on the project — the anticipated
  `create extension` step for `gen_random_uuid()`/`gen_random_bytes()`
  wasn't actually needed.
- **Verified schema**: `list_tables` shows all 19 expected tables in
  `public`, every one with `rls_enabled: true`. `get_advisors(security)`
  flagged the RLS helper functions (`current_user_role()` etc.) as
  callable via RPC by anon/authenticated — expected/standard for this
  pattern (revoking EXECUTE would break the RLS policies that call them),
  left as-is.
- **Created a real admin account**: `admin@phadincoffee.dev`
  (password shared with the user out-of-band, not recorded here),
  `profiles.role = 'admin'`. The public `/auth/v1/signup`
  endpoint hit Supabase's shared email rate limit before creating anything
  (confirmed via `select * from auth.users` — empty after the 429), so the
  user was created by inserting directly into `auth.users`/`auth.identities`
  via SQL (`pgcrypto`'s `crypt()`/`gen_salt('bf')` for the password hash,
  `email_confirmed_at` pre-set). Promoting to admin required temporarily
  disabling `profiles`' own `on_profile_role_change` trigger (it blocks the
  very first admin bootstrap too, since there's no admin yet to authorize
  the change) — re-enabled immediately after. **Verified the account
  actually authenticates** with a live call to
  `/auth/v1/token?grant_type=password` (output filtered through `node` to
  confirm `has_access_token`/`email_confirmed` without printing the raw
  token into the transcript).
- **Wired up real Supabase Auth for Login/Signup/Logout** (user chose this
  over starting on menu data, since it directly unblocks testing the new
  admin account against `/admin/*` and `/staff/*` gating):
  - `lib/roles.ts` — new shared `ROLE_HOME` map, extracted out of
    `middleware.ts` so both the middleware and the client-side login
    redirect use the same source of truth.
  - `components/auth/login-form.tsx` — real `signInWithPassword`, loads
    the user's `profiles.role` after sign-in and redirects to
    `ROLE_HOME[role]`, shows real Supabase error messages, loading state
    on the submit button.
  - `components/auth/signup-form.tsx` — real `signUp` with
    `full_name`/`phone` passed as `options.data`. This project requires
    email confirmation, so `data.session` comes back null on a normal
    signup — the form shows a new "check your email" screen instead of
    redirecting. Only writes `profiles.full_name`/`phone` and redirects
    immediately in the (here, untested) autoconfirm case.
  - `components/customer/profile-view.tsx` — Logout row is real now
    (`supabase.auth.signOut()` → redirect to `/menu` as a guest, not
    `/login`) — a previous session had already left an exact-spec comment
    for this on the disabled button, just needed Supabase Auth to exist.
  - New `Auth` message keys in both `messages/en.json` and `messages/vi.json`:
    `loggingIn`, `creatingAccount`, `loginError`, `signupError`,
    `checkEmailTitle`, `checkEmailBody`.
  - `npx tsc --noEmit` and `npm run build` both pass clean.
- **Updated `CLAUDE.md`** to match: Database section now says applied (not
  stubs), Login/Signup/Logout section rewritten to describe the real
  wiring and the email-rate-limit gap, "Current reality vs. planned" and
  "Building the rest" updated.

## Known gaps / things the next session should know

- **Email confirmation is effectively broken for new signups right now**:
  this hosted Supabase project's shared email sender is rate-limited hard
  enough that one real signup attempt during today's setup got
  `over_email_send_rate_limit`. A real customer signing up today would
  likely never receive their confirmation email. Fixing this needs a
  custom SMTP provider configured in the Supabase dashboard (Auth →
  Settings) — not something available through any MCP tool here. Worth
  doing before this app is shown to anyone outside of the admin test
  account.
- **No browser automation tool in this environment** (checked for
  `chromium-cli`/Playwright — neither installed). Login/Signup/Logout were
  verified by (a) `npm run build`/`tsc` passing, and (b) a direct curl to
  Supabase's own `/auth/v1/token` endpoint confirming the admin account's
  password hash is correct and the account is confirmed — but the actual
  Next.js cookie/session wiring in a real browser (does clicking "Log In"
  in the UI actually land an admin on `/admin/dashboard`?) has not been
  visually confirmed. If a browser tool becomes available, that's the
  first thing to check.
- Google OAuth buttons on both forms are still disabled+tooltip — no
  OAuth client configured, out of scope for today.

## Next session starts here

Pick up wiring real Supabase queries into whatever's still mock, roughly
in dependency order (most-referenced first):

1. **`lib/mock-data/menu.ts` → real queries** (`categories`, `menu_items`,
   `menu_item_sizes`, `modifier_groups`, `modifiers`). Feeds the customer
   Menu page, Product Detail page, POS terminal, and Admin Menu
   Management — the single highest-leverage replacement. All of those
   tables already allow public `select` via RLS, so this is read-only to
   start.
2. **`hooks/useInventory.tsx`** → real `ingredients`/`inventory_logs`
   queries (Dashboard low-stock widget + Inventory page).
3. **`hooks/useTables.tsx`** → real `tables` queries (QR flow, Admin
   Tables).
4. **Orders** (`hooks/useOrders.tsx`, `hooks/useKitchenOrders.tsx`) → real
   `orders`/`order_items`/`order_item_modifiers`, ideally via a
   `place-order` Edge Function for the actual write (atomicity across
   order + items + inventory deduction) rather than direct client inserts
   — this is exactly what the plan doc's Task 11 `place-order` function is
   for. Written in the plan doc but not yet deployed
   (`supabase/functions/place-order/index.ts` is still a stub).
5. **Admin Staff Accounts** (`components/admin/staff-accounts.tsx`) needs
   real user creation, which hits the same "no service-role key / no
   Admin API access" constraint hit today for the test admin account —
   worth deciding then whether to request a service-role key from the
   user or keep using the direct-SQL-insert workaround for new staff too.

Before any of the above, if a browser tool is available in the new
session, spend five minutes actually clicking through Login → Signup →
Logout in a live browser against the running dev server — that's the one
piece of today's work that's unverified beyond typechecking + a raw API
call.
