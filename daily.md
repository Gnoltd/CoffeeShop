# Follow-up fixes: StaffNav badge overlap fixed; KDS hydration warning still unresolved despite real effort

## Follow-up fixes (same session as the 3 mobile redesigns above)

**StaffNav badge overlap: fixed and live-verified.** The `flex-wrap`
attempt didn't actually trigger — brand (138px) + nav (~200px) fit
inside the header's own 358px content width without needing to wrap,
so `flex-wrap`'s own algorithm never kicked in (fitting-in-width and
not-colliding-with-an-external-fixed-overlay are different
conditions). Switched to an unconditional `flex-col`/`md:flex-row`
stack instead — nav always renders on its own row below the badge
cluster's fixed vertical span on mobile, regardless of whether it
would have technically fit on one line. First attempt still had a 6px
vertical / 9px horizontal corner clip (row 2 started 2px before the
badge's bottom edge) — widened the row gap from `gap-2` to `gap-5`,
re-measured, confirmed clear (row 2 now starts at y=52, badge bottom
is y=46). Desktop confirmed pixel-identical (`header` height still
exactly 56px, single row, unchanged). This completes the "every mobile
redesign this session hit the same fixed badge cluster" pattern noted
above — all four known instances (POS, KDS, Admin, and now StaffNav)
are fixed.

**KDS hydration warning (React #418): investigated hard, NOT fixed —
reporting honestly rather than claiming success.** Changed
`kitchen-display.tsx`'s `now` state from `useState(() => Date.now())`
to `useState(0)` + setting the real value in a `useEffect` after
mount — the textbook-correct fix for exactly this class of bug (a
`Date.now()` lazy initializer runs once during SSR and again during
client hydration, producing two different embedded values). This is a
real, deployed improvement (removes a genuine mismatch source), but
the live error **persists on `https://phadincoffee.vercel.app`
regardless** — confirmed via direct Playwright `pageerror` capture,
full stack trace pulled (unhelpful, fully minified, no component
names). Extensive attempts to reproduce it anywhere *other than* the
live Vercel deployment all failed to trigger it at all: local `next
dev`, local `next start` (production build, matching Vercel's runtime
mode) across 3 repeated loads, and local `next start` under
CDP-emulated network throttling (500kbps down/up, 400ms latency,
intended to simulate the real SSR→hydration timing gap Vercel's actual
network round-trip introduces). Grepped every KDS-related file
(`kitchen-*.tsx`, `orders/layout.tsx`, `useKitchenOrders.tsx`,
`useTables.tsx`) for other `Date.now()`/`Math.random()`/`localStorage`-
during-render patterns — found none; `useTables.tsx`'s `activeTable`
already has its own `hydrated` guard flag, so that's not it either.
**Root cause is still unidentified.** Given it's non-fatal (React
recovers by re-rendering client-side; every KDS interaction has been
verified working correctly across all three mobile redesigns' live
testing despite this warning being present throughout), and given the
`now=0` fix is a genuine improvement even if incomplete, this is being
left as a known, low-priority, non-blocking issue rather than chased
further right now. Next real lead if picked back up: deploy a
temporary debug build with `next.config`'s `productionBrowserSourceMaps:
true` (not currently enabled) to get an actual component name/line
number out of the minified stack trace instead of guessing further, or
add explicit `console.log` instrumentation to a suspect render path
and read Vercel's function logs.

## Status

Starbucks-style customer motion redesign (2026-07-09) is shipped,
merged to `main`, and live-verified on
`https://phadincoffee.vercel.app`. Framer Motion + a new
`components/motion/` primitives layer (segmented control, stagger
list, bottom sheet, animated counter/ring/step-progress, route/tab
transitions) wired into every customer page (Menu, Product Detail,
Cart, Checkout, Order Tracking, Order History, Profile, Loyalty,
Bottom Nav) — colors/layout/business logic untouched, motion only.
Also fixed along the way: Menu now has an "All" category option
(defaults selected), and the landing page's top nav "Menu" link no
longer has a permanently-active state that blocked its hover highlight
(now matches Orders/Loyalty/Profile). Two real bugs found and fixed
during live iteration: Framer Motion's `layout` prop on every list item
plus a `layoutId` on every menu card's image were both forcing
expensive whole-tree layout measurement on unrelated interactions
(e.g. opening the quick-add bottom sheet) — dropped both, cutting a
~1-1.5s interaction lag down to near-instant. Spec/plan:
`docs/superpowers/{specs,plans}/2026-07-09-starbucks-customer-motion*.md`.

**In progress, paused for next session**: making Admin/KDS/POS
phone-adaptable (currently laptop/PC-only). Resumed brainstorming
2026-07-09 (second session): Stitch *read* access is back
(`list_projects`/`list_screens`/`list_design_systems` all work — the
"PhaDin Coffee Management System"/"POS Mobile Test" projects are still
gone, but a "Coffee Shop App" project (`4654820544595168289`) exists
with a full desktop-only screen set for Admin Dashboard, KDS Board,
Staff POS, Tables/Staff/Menu/Inventory Management, Order History, and
System Settings, plus one shared design system, "Phố Coffee"
(`assets/7846627771704298063`) matching this project's brand tokens).
`generate_screen_from_text` itself (the actual generation call) still
fails with the same missing-OAuth-credential error as before, even
though read calls succeed — confirmed by directly attempting a
generation this session, not just assumed. **Re-confirmed a third time
2026-07-09 (third session)**, after a plugin reinstall/reload of
`frontend-design` — read calls (`list_projects`) still work, but
`generate_screen_from_text` against the same project/design-system
still returns the identical "missing required authentication
credential" OAuth error. The plugin reload does not affect Stitch's
own auth store, so this isn't something reload/reinstall can fix.

**Root cause found (still same session)**: `gcloud` is not on PATH,
but a local `gcloud` SDK + real OAuth login for
`dothanhlong166@gmail.com` already existed under
`~/.stitch-mcp/google-cloud-sdk`/`~/.stitch-mcp/config` from an earlier
`stitch-mcp init --local` — that wasn't actually the blocker. The real
cause: both Stitch MCP entries in `~/.claude.json` (`stitch-mcp` stdio
proxy's `STITCH_API_KEY` env, `stitch` HTTP server's `X-Goog-Api-Key`
header) held an **expired** Stitch project API key — `stitch-mcp
doctor` started returning 401 on the same key that once passed. User
provided a fresh API key from the Stitch project; swapped it into both
`~/.claude.json` entries (backed up the original file first). **Not
yet verified live** — the already-running `stitch-mcp` subprocess for
this session captured the old key at spawn time, so a live retry
during this same session still 401's; a plain OS-level
`STITCH_API_KEY` env var (separate from `~/.claude.json`, used only by
the raw CLI) was also updated but is similarly stuck stale until a
fresh process. **Needs a Claude Code session restart** (respawns the
MCP subprocess with the corrected config) before `generate_screen_from_text`
can be retried for real confirmation — next session should retry it
first thing. If it still fails post-restart, the key itself (not just
staleness) is the next thing to question.

Design decisions locked in for when generation is unblocked (all
approved, ready to execute without re-asking): scope covers all three
areas together in one Stitch-generation pass (not just POS first).
**POS**: "Menu ⇄ Order" page-swap (same pattern as the customer
Menu→Cart flow) over a bottom-sheet/persistent-draggable-panel
alternative; Order view's Charge action is a sticky bottom bar (not
end-of-scroll). **KDS**: desktop's 5-column board (4 status columns +
Tables) collapses to a horizontal segmented-control switcher — reusing
the same segmented-control motion primitive already built for the
customer Menu's category filter — one column visible at a time;
sidebar shift-stats collapse into a compact top summary bar. **Admin**:
left sidebar (7 sections — too many for a 5-slot BottomNav) becomes a
slide-out hamburger drawer instead; Dashboard KPI cards stack vertically
instead of desktop's grid.

**Retried 2026-07-09 (fourth session, post-restart) — confirmed dead,
Stitch generation abandoned for this feature.** Both connectors
(`mcp__stitch__generate_screen_from_text` and
`mcp__stitch-mcp__generate_screen_from_text`) still 401 on the exact
key the third session had swapped in — ruling out subprocess
staleness. Verified the key is identical (byte-for-byte) across all
three places it's stored (`~/.claude.json` global `stitch`/`stitch-mcp`
entries, plus a third project-scoped override under
`projects["C:/Users/dotha/OneDrive/Desktop/CoffeeShop"].mcpServers.stitch`
that config-sync had missed but happened to already hold the same
value) — `stitch-mcp doctor` confirms 401 directly against the Stitch
API, not a local config-sync problem. User re-supplied what turned out
to be the same key twice more (clipboard/dashboard-tab staleness on
their end); re-running `claude mcp add stitch` with it is a no-op since
the value is unchanged. **Tried the OAuth/ADC fallback instead of the
API key** (`~/.stitch-mcp` has a working `gcloud` login for
`dothanhlong166@gmail.com` from an earlier `stitch-mcp init --local`):
authenticates fine, but fails differently — **403**, not 401 — because
the ADC has no `serviceusage.services.use` permission on the
auto-created GCP project `light-phantasmata-nfs6l`
(`gcloud auth application-default set-quota-project` fails with that
exact IAM error). So there are now two independently-broken auth paths,
both needing a fix only the user can make in a Google/Stitch web
console (grant IAM on that GCP project, or get a genuinely new — not
re-pasted — Stitch API key). **User chose to abandon live Stitch
generation and fall back to the manual/reference approach.**

**POS mobile redesign: shipped, same session.** Built by hand (no
Stitch mockup, per the fallback above) — design:
`docs/superpowers/specs/2026-07-09-pos-mobile-redesign-design.md`,
plan: `docs/superpowers/plans/2026-07-09-pos-mobile-redesign.md`, both
executed inline task-by-task. `components/staff/pos-terminal.tsx`'s
order-ticket JSX extracted into a local `OrderPanel` subcomponent
(shared by both the desktop `<aside>` and a new mobile-only overlay,
zero duplication); below `md` the layout is a "Menu ⇄ Order" swap
driven by local `mobileView` state, animated with the same
`AnimatePresence`/timing curve as `RouteTransition` (keyed on state
instead of `pathname`, since POS has no separate routes to swap
between); a sticky "View Order (N) · total" bar appears over the Menu
view once the ticket has items; the Order view's Charge action was
already effectively sticky (outside the scrolling line-item region in
the original flex layout) and stays that way on mobile. Desktop
(≥`md`) is confirmed pixel-identical — every mobile class is paired
with an `md:` override. Live-verified on
`https://phadincoffee.vercel.app` via a temporary Playwright script
(installed with `npm install --no-save playwright`, not committed,
deleted after use): logged in as `admin@phadincoffee.dev`, confirmed
the desktop two-pane layout is unchanged, then on a 390×844 mobile
viewport confirmed the sticky bar's item count/total, the swap
animation, the back button, and a full real Cash charge through
`place-order` (order created, ticket cleared, view auto-returns to
Menu) — all passed, screenshots reviewed directly. **One pre-existing,
out-of-scope issue spotted incidentally**: at phone width, `StaffNav`'s
nav links visually overlap the fixed `LanguageSwitcher` pill (the
Admin-layout `pt-16` compensation mentioned in `CLAUDE.md`'s
cross-cutting gotchas was never applied to the staff layout) — not
touched, since it predates this change and wasn't in scope, but worth
a follow-up.

**KDS mobile redesign: shipped, same session.** Design:
`docs/superpowers/specs/2026-07-09-kds-mobile-redesign-design.md`,
plan: `docs/superpowers/plans/2026-07-09-kds-mobile-redesign.md`.
`kitchen-board.tsx` switches `display` by breakpoint (`flex flex-col`
mobile / `md:grid md:grid-cols-4` desktop, not CSS Grid `auto`-row
sizing for a single visible child — that can't resolve `h-full`) with
a `SegmentedControl` (New/Preparing/Ready/Tables) driving which column
is visible below `md`; `kitchen-tables-column.tsx` got a matching
`active` prop. `kitchen-sidebar.tsx`'s `<aside>` hidden below `md`,
its nav links + shift-stats moved into a new `md:hidden` strip in
`orders/layout.tsx` (shared by both `/staff/orders` and
`/staff/orders/history`). `kitchen-stats-footer.tsx` got a 2-row
mobile layout. All live-verified the same way as POS (temporary
Playwright script, deleted after use) — desktop confirmed pixel-
identical, mobile column-switching/nav-strip/history-nav all confirmed
working.

**`kitchen-top-bar.tsx` needed 4 live-verification iterations to get
right** — worth remembering for any future header-chrome work: the
original desktop-only `mr-52` (reserving space for the global fixed
`RoleBadge`+`LanguageSwitcher` pill cluster in `app/[locale]/layout.tsx:64-67`,
**not just the switcher alone** — a more precise root cause than the
POS session's writeup assumed) needed a mobile equivalent. `mr-16`,
then `mr-48`, then `mr-64` on the *child* all rendered **identically**
(confirmed by direct measurement, not assumption) — because
`justify-content: space-between` only distributes whatever free space
actually exists between two flex items; once requested margin meets or
exceeds that free space, the items just go edge-to-edge and any
*additional* margin is silently absorbed with zero visual effect. This
is a real, reusable CSS lesson: **on a cramped flex row, neither more
child margin nor more parent padding fixes an overlap if the two
items' own natural content width already exceeds the available space
— the actual fix is shrinking content**, not requesting more space
that doesn't exist. Fixed by hiding the "System Online" text label
below `md` (keeping just the status dot) and hiding the
divider+`stationLabel` text below `md` (it was wrapping into the badge
cluster's zone) — confirmed clear via exact pixel measurement
(`getBoundingClientRect()`), not just eyeballing a screenshot.

**Also noticed, not fixed (pre-existing, out of scope)**: `/staff/orders`
throws a React hydration error (#418, text-content mismatch) on every
page load, both desktop and mobile, before and unrelated to this
session's changes — almost certainly `kitchen-stats-footer.tsx`'s
`now`/`clock` state (`useState(() => Date.now())`), which independently
evaluates once at SSR time and again at client-hydration time, trivially
producing a different clock string. Non-fatal (React recovers and every
downstream interaction still worked in verification), but worth a
real fix later: seed `now` from `null`/skip the clock's first render
until mounted, matching the common `suppressHydrationWarning`-or-
mount-gate pattern for this kind of client-only-varying value.

**Admin mobile redesign: shipped, same session — all 3 sub-projects
now complete.** Design:
`docs/superpowers/specs/2026-07-09-admin-mobile-redesign-design.md`,
plan: `docs/superpowers/plans/2026-07-09-admin-mobile-redesign.md`.
Turned out smaller in scope than POS/KDS: `dashboard-view.tsx` and
every other admin page content file already stacked correctly below
their existing breakpoints (`grid-cols-1` base + `sm:`/`lg:` overrides,
`overflow-x-auto` table wrappers) — confirmed by reading each file
during design, not assumed — so the only real blocker was the fixed
`w-64` sidebar itself, no page content changes needed. New
`components/motion/side-drawer.tsx` mirrors `bottom-sheet.tsx`'s
scrim+spring conventions exactly, axis-flipped to slide in from the
left instead of up from the bottom — the first time this session
explicitly reused another primitive's *conventions* (spring constants,
scrim treatment) rather than the primitive itself (KDS reused
`SegmentedControl` outright; POS reused `RouteTransition`'s timing
constants inline). `admin-sidebar.tsx`'s nav markup extracted into
`AdminNavContent`, shared by the always-visible desktop `<aside>` and
the drawer (same extraction pattern as POS's `OrderPanel`). New
`AdminMobileHeader` is deliberately left-aligned only (no right-side
content) specifically to dodge the KDS top-bar's overlap problem by
construction — and even so, live measurement still caught a real
**-3.8px overlap** with the global `RoleBadge`+`LanguageSwitcher`
cluster (brand text just barely too wide), fixed by tightening
gap/padding rather than by hiding content, confirmed clear at +14.2px
afterward. Worth noting as a pattern now: **every one of the 3 mobile
redesigns needed at least one live-measurement-driven fix against that
same fixed badge cluster** — POS's `StaffNav` overlap (still unfixed,
out of scope), KDS's top bar (4 iterations), Admin's header (1
iteration, caught fast because it was measured immediately instead of
eyeballed). A real fix to `StaffNav` is now the most valuable
remaining follow-up in this general area.

All three plans followed the same pipeline this session: brainstormed
design decisions (from the pre-Stitch session) → written design spec →
`writing-plans` → inline execution task-by-task → live Playwright
verification (temporary script, deleted after use, never committed) →
`daily.md` update. Live-verified end-to-end on
`https://phadincoffee.vercel.app`: desktop pixel-identical on all
three surfaces, mobile Menu⇄Order swap (POS), segmented-control column
switcher (KDS), and hamburger drawer (Admin) all confirmed working,
including real interactions (a full Cash charge on mobile POS,
navigation + drawer auto-close on mobile Admin).

Deferred payment + table-driven service lifecycle and table status are
both shipped, live-verified, and working — see CLAUDE.md for the
structural summary of both features. A handful of real bugs found
during live testing (trigger column-scope gap, a fake-table checkout
fallback, an RLS gap blocking staff writes to `tables`, a missing KDS
manual override, a Realtime UX lag) were all found and fixed the same
day; no follow-up needed.

Spotlight hero landing redesign (2026-07-09) is shipped and
live-verified: full-screen dark hero with cursor/touch-following
spotlight reveal (CSS gradient mask, no canvas), Playfair Display italic
display accent, adapted nav, Order Now + Scan QR CTAs, both locales,
promo/best-sellers/categories intact below. `CustomerHeader` was removed
from the marketing layout only (the hero's `LandingNav` is that page's
header); `BottomNav` stays. Spec/plan:
`docs/superpowers/{specs,plans}/2026-07-08-spotlight-hero-landing*.md`.

Admin Dashboard real data + Excel export is implemented, typechecked,
built, unit-tested (71/71 passing), and pushed/deployed to
`https://phadincoffee.vercel.app` — `get_dashboard_stats()` RPC
(migration `0026`) backs real revenue/orders/loyalty KPIs, a 7-day
chart, and best sellers, all Realtime on `orders`/`order_items`/
`loyalty_transactions`. A 5-sheet `.xlsx` export button (`xlsx`/
SheetJS) was added alongside it. Not yet walked through by hand on the
live site — see Open below.

## Open / not started

1. **Live-verify the Admin Dashboard** — confirm real KPI numbers
   (cross-check Orders Today against Staff Order History), the 7-day
   chart's bars/weekday labels, Best Sellers reflecting real orders,
   a Realtime update after placing a new paid order, and the Excel
   export (all 5 sheets, correct Vietnamese text, real numeric cells
   for revenue/quantity columns — not text).
2. **POS/KDS/Admin mobile redesign** — resume brainstorming for POS
   first (see Status above for where it left off), then KDS, then
   Admin, each its own spec/plan/build cycle.

## Known gaps (documented, not hidden — pick up whenever that area is next touched)

- `VNPAY_RETURN_URL` (synced to Vercel) is dead — VNPay's actual return
  URL is built dynamically in `place-order` pointing at the Supabase
  function URL instead. Worth removing the unused Vercel var, or
  documenting why it's kept, next time env vars are audited.
- `next build` still prints the "middleware deprecated, use proxy"
  warning (Next.js 16.2.10). Renaming `middleware.ts` → `proxy.ts` also
  touches `lib/middleware-rules.ts`, which it depends on. Not urgent.
- No Vitest/RTL coverage beyond the `lib/supabase/*.ts` query layers and
  `lib/middleware-rules.ts`/`lib/get-current-role.ts` — component-level
  tests were never added (skipped so far, not a regression).
- POS (`components/staff/pos-terminal.tsx`) always collects payment in
  person (`paymentCollected: true`) — Pay Later is a self-checkout-only
  concept, deliberately (POS staff are standing right there).
- A **pickup** Pay Later order sitting at `served`/unpaid/no-method-
  chosen has no staff-side "Mark Cash" surface (unlike dine-in's table
  card) — only the customer's own tracking page can choose a method for
  it. Pickup has no table to attach that control to.

Two throwaway test accounts (staff/customer roles, credentials in
`.env.local` and the gitignored `test-accounts.md`) are kept
deliberately for the user's ongoing manual testing — not a cleanup gap,
don't remove or flag these.
