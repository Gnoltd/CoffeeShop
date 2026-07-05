# Today: Profile auth-gate + role-based navigation shipped and verified live

## Task

Picked up exactly where the previous session's handoff (this file) left
off: the Profile auth-gate + role-based-navigation brainstorm was blocked
on a Stitch MCP connection the user was setting up. This session confirmed
Stitch was connected, used it to generate the two approved mockups,
finished the brainstorming → spec → plan cycle, then executed the full
plan inline (user chose inline execution over subagent-driven) directly
on `main` (user's explicit choice, matching the previous session's
menu-data-migration precedent).

## Done this session

- **Confirmed Stitch was connected** — `mcp__stitch-mcp__list_projects`
  still 401'd ("API keys are not supported... expected OAuth2"), but the
  separate `mcp__stitch__` server (distinct tool namespace) worked and
  could see the existing project `4654820544595168289`.
- **Generated and got approval on 2 Stitch mockups** via `edit_screens`:
  a "Staff Access" card on the Profile screen (secondary coffee-brown,
  role-labeled headline/subtext, "Go to Admin Dashboard" button — screen
  `4e4bcae94d9d422f97df6e41e18b6790`), and a compact "Staff" badge in the
  Home header next to the language switcher (screen
  `1d413b40d2904396862d12674d5863e9`). Downloaded both screenshots locally
  to show the user before proceeding.
- **Finished the brainstorming skill's checklist**: proposed 3 code-structure
  approaches (extend `middleware.ts` + a server-side role helper vs. a
  root-level Context vs. fully client-side checks), recommended and got
  approval for the middleware-extension approach, presented the full
  design in two parts, got approval, wrote
  `docs/superpowers/specs/2026-07-06-profile-auth-role-nav-design.md`,
  self-reviewed (caught and fixed a screen-ID typo and a "TBD" placeholder
  in the translations section), got user sign-off, committed.
- **Wrote the implementation plan**,
  `docs/superpowers/plans/2026-07-06-profile-auth-role-nav.md` — 5 tasks,
  self-reviewed against the spec, committed.
- **Executed all 5 tasks inline** (user chose inline execution over
  subagent-driven), each with its own commit:
  1. Middleware auth gate — `/profile`, `/orders`, `/loyalty` now
     hard-redirect a guest to `/login`, exact-path matched (not prefix)
     so `/orders/[orderId]` stays guest-accessible. **Real blocker hit
     and fixed**: importing `middleware.ts` in a Vitest test pulls in
     `next-intl/middleware` → `next/server`, which fails to resolve
     under Vitest's SSR module resolution in this environment (confirmed
     a `vitest.config.ts` alias doesn't help — Vitest's SSR resolution
     for `node_modules` bypasses configured aliases). Fixed by extracting
     the pure routing logic into a new `lib/middleware-rules.ts` (zero
     `next-intl`/`next/server` imports); `middleware.ts` now just imports
     and uses it. 9 new tests, all passing.
  2. `lib/get-current-role.ts` — DI'd against a `SupabaseClient` (same
     convention as `menu-data.ts`), 3 new tests.
  3. `CustomerHeader` role badge — wired into all three layouts
     (marketing/auth/customer) via a new `getCurrentRole()` call site
     each. Deliberately used a plain `Link`, not `Button`, since
     `CustomerHeader` is a Server Component and every existing
     `Button`+`render={<Link/>}` usage in this codebase is from a
     `"use client"` component.
  4. `ProfileView` staff-access card — role prop, card UI, wired into
     `profile/page.tsx`.
  5. Full verification: `tsc`/`eslint` (exactly the same 5 pre-existing
     `react-hooks/set-state-in-effect` errors, unrelated files, count
     unchanged)/`vitest run` (15/15)/`npm run build`, then pushed to
     `origin/main` (user confirmed) to trigger the Vercel deploy, then a
     live Playwright pass. Updated `CLAUDE.md`'s Profile section to
     describe the shipped feature instead of the old known-gap note.
- **Live verification details, including two real auto-mode safety
  blocks that were the right call**:
  - A broad `select role, email from profiles join auth.users` was
    blocked (production PII in the transcript without the user naming
    that specific query) — didn't try to work around it, asked the user
    instead.
  - Creating throwaway staff/customer test accounts (same direct-SQL
    bootstrap method as the original `admin@phadincoffee.dev` account,
    since public signup hits Supabase's shared email rate limit) was
    blocked once for a vague "create account and test" approval not
    specifically naming the action of disabling
    `on_profile_role_change` (a role-escalation safeguard) on production.
    Re-asked, user explicitly approved that exact SQL, then it succeeded.
    Two accounts now exist: `test.staff.rolenav@phadincoffee.dev` (role
    `staff`) and `test.customer.rolenav@phadincoffee.dev` (role
    `customer`) — credentials saved to `.env.local`
    (`TEST_STAFF_EMAIL`/`TEST_STAFF_PASSWORD`,
    `TEST_CUSTOMER_EMAIL`/`TEST_CUSTOMER_PASSWORD`), user chose to leave
    them in place for future testing rather than delete them.
  - A verification script was also blocked once for hardcoding the real
    admin password in a file written inside the git-tracked project
    directory — fixed by deleting that stray file and rewriting the
    script to read all credentials from environment variables passed at
    invocation time, never persisted to disk in plaintext.
  - Final Playwright pass against `https://phadincoffee.vercel.app`: all
    17 checks passed — guest redirected away from `/profile`/`/orders`/
    `/loyalty` but not `/orders/[orderId]`; customer sees no badge/card
    and isn't gated; staff sees the "Nhân Viên" badge + profile card +
    working "Go to POS" button; admin sees "Quản Trị" + working "Go to
    Admin Dashboard" button. (Two apparent failures on the first pass
    turned out to be test-script timing artifacts — Playwright's
    `networkidle` not firing reliably after a Next.js client-side soft
    navigation — not product bugs; added diagnostics, confirmed the real
    DOM/behavior was correct all along, fixed the test's wait strategy.)
- Cleaned up: temporary verification script and mockup screenshots
  removed from the scratchpad; confirmed `.env.local` is gitignored
  before it was ever staged.
- Ran the `finishing-a-development-branch` skill: tests green, but since
  this was worked directly on `main` (not a separate branch) per the
  user's explicit choice, there was nothing to merge/PR/discard — the
  work already *is* `main`, already pushed and live.

## Next session starts here

- This feature is done — no known follow-up work for it. The one
  pre-existing, explicitly out-of-scope item is `ProfileView`'s
  hardcoded mock name/phone/email (`INITIAL_PROFILE`), unchanged by this
  session, tracked in `CLAUDE.md`.
- Two throwaway test accounts (staff/customer roles) now exist in the
  live Supabase project — reuse them (credentials in `.env.local`) rather
  than recreating via SQL if a future session needs non-admin role
  testing again.
- Noticed but did not act on (out of scope for this session): `next build`
  now prints "The 'middleware' file convention is deprecated. Please use
  'proxy' instead" (Next.js 16.2.10). Not urgent, but worth a dedicated
  pass at some point — `middleware.ts` (and the new `lib/middleware-rules.ts`
  it depends on) would need renaming/restructuring per Next's new
  convention.
- Remaining backend work is otherwise unchanged from before this session:
  inventory, tables, orders, and staff accounts are still
  `lib/mock-data/*`/local-hook mocks waiting on real Supabase queries,
  roughly in that order of how many other pages depend on them (see
  CLAUDE.md's "Building the rest"). Edge Functions
  (`place-order`/`stripe-webhook`/`vnpay-ipn`/`vnpay-return`) are still
  comment-only stubs.
