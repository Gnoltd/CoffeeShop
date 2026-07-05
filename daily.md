# Today: Menu data migration shipped end-to-end, app deployed live on Vercel, Profile auth-gate work started

## Task

Picked up from the previous session's handoff (this file): executed the
already-written `docs/superpowers/plans/2026-07-05-menu-data-migration.md`
plan (10 tasks) via the subagent-driven-development skill. After it
shipped, the user asked to deploy to Vercel and stop verifying against
localhost. That surfaced a real bug in Profile (no auth-awareness) plus a
feature request (role-based navigation), which is now mid-brainstorm and
blocked on a Stitch MCP connection the user is setting up.

## Done this session

- **Executed the full 10-task menu-data-migration plan**, one
  implementer + reviewer cycle per task, working directly on `main` (user
  declined worktree isolation):
  1. Migration `0008` — bilingual `name_vi`/`name_en`/description columns
     + `icon`/`is_popular` on `categories`/`menu_items`/`modifier_groups`/
     `modifiers`.
  2. Migration `0009` — seeded the real 9-item menu (4 categories, 15
     sizes, 1 modifier group/2 modifiers) ported from
     `lib/mock-data/menu.ts`. Verified PostgreSQL executes an unreferenced
     writable CTE (`INSERT ... RETURNING` followed by a bare `select 1`)
     before trusting this pattern against production.
  3-4. `lib/supabase/menu-data.ts` — DI'd query module (`SupabaseClient`
     first arg), TDD'd with Vitest: `getCategories`/`getMenuItems`/
     `getMenuItemById`/`createMenuItem`/`updateMenuItem`/`deleteMenuItem`.
  5-8. Wired Landing, Menu Browser, Product Detail, POS Terminal to the
     real data.
  9. Wired Admin Menu Management to real client-side CRUD (first task
     using `lib/supabase/client.ts`'s sync browser client) — added an icon
     picker + Popular toggle to the item form.
  10. Deleted `lib/mock-data/menu.ts`, updated CLAUDE.md, full
     build/typecheck/lint/test + real-browser (Playwright) manual pass.
  - **Real bug found and fixed** (Task 6's review): `item.sizes ||
    item.modifierGroups` always evaluated true once these became
    always-present arrays on the real type (empty array is truthy) —
    broke one-tap quick-add for every item. Fixed to `.length > 0` in
    Menu Browser, proactively also fixed in Product Detail (same pattern,
    same file class).
  - **Final whole-branch review** (opus, all 11 commits) found two more
    real issues, both fixed with user approval: Admin's image-upload form
    was about to persist ephemeral `blob:` URLs into the real
    `menu_items.image_url` column (the plan's own code specified this —
    nobody caught it until writes became real); `getMenuItems` had no
    `ORDER BY`, making item display order nondeterministic. Both fixed in
    one follow-up commit.
  - Mid-task 9, discovered `admin@phadincoffee.dev`'s password (stored in
    `.env.local`) no longer authenticated. **Reset it via SQL with the
    user's explicit authorization** (same bootstrap method used to create
    the account originally), then completed the live-browser CRUD
    verification that had been blocked.
  - One disclosed, intentionally-unreverted side effect: "Iced Milk
    Coffee"'s `base_price` is now 31000 (seeded at 29000) from the
    verification pass's price-edit test step, which didn't call for a
    revert. User's choice to leave it.
  - `npx eslint .` has 5 pre-existing `react-hooks/set-state-in-effect`
    errors, confirmed via git blame to predate this entire plan (not
    introduced by any of today's commits) — flagged, not fixed, out of
    scope.
- **Pushed to GitHub for the first time**: `origin` (`Gnoltd/CoffeeShop`)
  had no commits at all before today. `main` now tracks `origin/main`,
  12 commits pushed.
- **Deployed to Vercel**: linked as project `phadincoffee` under
  `gnoltd-s-projects`, auto-connected to the GitHub repo (every push to
  `main` now auto-deploys). Live at `https://phadincoffee.vercel.app`,
  verified the locale-redirect middleware works there (`/` → `/vi`, 307).
- **Synced env vars to Vercel** (Production/Preview/Development):
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (in
  active use), `NEXT_PUBLIC_SITE_URL`/`VNPAY_RETURN_URL` (real domain for
  prod/preview, localhost for dev — not read by any code yet), and
  `SUPABASE_SECRET_KEY`/`STRIPE_SECRET_KEY`/`VNPAY_TMN_CODE`/
  `VNPAY_HASH_SECRET` (real values the user filled into `.env.local`
  mid-session, synced ahead of any code that reads them).
  `STRIPE_WEBHOOK_SECRET` stays empty — no webhook endpoint exists yet to
  generate one against. User manually added the Supabase Auth "URL
  Configuration" redirect allow-list entries for the live domain
  (Dashboard-only setting, no MCP tool exposes it).
- **User confirmed a standing preference: verify against the live Vercel
  URL from now on, not localhost** — saved to memory
  (`feedback_deploy_not_local.md`). Local `build`/`tsc`/`eslint`/`test`
  are still fine for fast feedback; it's manual/browser verification that
  should target the live site.
- **User confirmed a standing preference: follow existing Stitch exports
  exactly for any UI work** — saved to memory
  (`feedback_design_follow_stitch.md`) — don't improvise new layouts.
- **Real bug surfaced by the user clicking around the live site**:
  `components/customer/profile-view.tsx` has zero auth-awareness. It
  always renders hardcoded mock data (`INITIAL_PROFILE` — a fake name/
  phone/email) regardless of login state, never checks the session, and
  never redirects a logged-out visitor. There's also no "Log In" entry
  point anywhere in the customer-facing pages, and no way for a logged-in
  staff/manager/admin browsing the customer side to get back to their own
  area. Started brainstorming a fix (see below).
- **CLAUDE.md and continuity.md updated** to reflect all of the above
  (deployment section added to CLAUDE.md, Profile's known-gap documented,
  continuity.md marked stale with a pointer to CLAUDE.md/this file).

## In-progress brainstorm: Profile auth-gate + role-based navigation

Not yet designed or implemented. Clarifying questions answered so far
(via AskUserQuestion, one at a time per the brainstorming skill):

1. Guest visiting `/profile` → **hard redirect to `/login`** (same pattern
   as `/staff`/`/admin` in `middleware.ts`), not an inline "please log in"
   card.
2. **Gate `/profile`, `/orders` (Order History list), and `/loyalty`** the
   same way — all three are account-specific and make no sense for an
   anonymous guest.
3. **`/orders/[orderId]` (the individual Order Tracking page) stays
   guest-accessible** — a guest reaches it right after Checkout today
   (guest checkout is real, no login required), so gating it would break
   that flow. Only the Order History *list* gets gated, not individual
   order tracking.
4. **Staff, Manager, and Admin all get a role-appropriate "Go to [X]"
   button** (Staff → POS, Manager/Admin → Admin Dashboard, reusing
   `lib/roles.ts`'s existing `ROLE_HOME` map) — not just Manager/Admin as
   first described.
5. Button location: **Profile page card + a persistent header link**
   (touches the shared `CustomerHeader`, used by marketing/auth layouts
   too — scope this carefully when designing).

**Blocked on:** the user wants this new UI designed in Stitch (per their
"follow Stitch designs" preference) rather than have me freehand it, and
wants me to connect to Stitch directly via MCP. I found and added
`@_davideast/stitch-mcp` to `.mcp.json` together with the user this
session — **but it requires `STITCH_API_KEY` as a real OS/shell
environment variable** (the user only put it in `.env.local`, which the
MCP server's `${STITCH_API_KEY}` expansion does not read), **and a fresh
session start** to pick up the newly-added server (this session already
loaded its toolset before the entry existed). The user is restarting for
exactly this reason.

## Next session starts here

1. **First, check whether Stitch is actually connected**: run
   `ToolSearch` with query `"stitch"` (or just try invoking a Stitch tool
   if one shows up unprompted in context). If it's there, that unblocks
   the brainstorm — resume by using it to produce mockups for the 2 real
   visual pieces (the role-based "Go to [X]" card on Profile and the
   persistent header link/badge — the guest-profile redirect itself is
   just a redirect, not something that needs a mockup).
   - If Stitch still isn't showing up, check `STITCH_API_KEY` is actually
     set at the OS level (`echo $STITCH_API_KEY` in bash, or check
     Windows env vars) before assuming the MCP server itself is broken.
   - If it's still not resolved and the user wants to keep moving, the
     already-offered fallback is: design this directly, reusing the app's
     existing card/button/color patterns (there's no existing Stitch
     mockup for a guest-state Profile or a role-switcher to diverge from
     anyway, so this isn't overriding an approved design).
2. Once the design step is unblocked (Stitch or direct), **finish the
   brainstorming skill's checklist**: propose 2-3 approaches for the
   actual code structure (e.g. does the auth/role check happen in
   `middleware.ts`, extending the existing `resolveRedirect`/
   `ROUTE_GROUP_ROLES` pattern already used for `/staff`/`/admin`, or a
   client-side check in `profile-view.tsx` itself?), present the design
   in sections, get approval, write the spec to
   `docs/superpowers/specs/2026-07-06-profile-auth-role-nav-design.md`,
   self-review it, get the user's sign-off on the written spec, then
   invoke `writing-plans` to turn it into an implementation plan before
   any code gets written.
3. After that feature ships: the remaining backend work is unchanged from
   before — inventory, tables, orders, and staff accounts are still
   `lib/mock-data/*`/local-hook mocks waiting on real Supabase queries,
   roughly in that order of how many other pages depend on them (see
   CLAUDE.md's "Building the rest"). Edge Functions
   (`place-order`/`stripe-webhook`/`vnpay-ipn`/`vnpay-return`) are still
   comment-only stubs — the Stripe/VNPay secrets are now sitting in both
   `.env.local` and Vercel ready for when that work starts.
