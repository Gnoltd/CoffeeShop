# Payment method correction shipped; real reviews + real menu images backfilled into this log

## Payment method correction: tracking-page change + KDS Undo Cash (shipped, new session)

Implements `docs/superpowers/plans/2026-07-10-payment-method-correction.md`
(design: `docs/superpowers/specs/2026-07-10-payment-method-correction-design.md`).
Fixes three real Pay Later gaps: a served customer who taps Cash on the
tracking page had `payment_method` recorded instantly with no way to
switch to Card/VNPay; a customer who picked Card/VNPay and abandoned the
gateway page came back locked to that method; staff who tapped "Mark
Cash" on the wrong KDS table card had no undo. One new guest-safe
`security definer` RPC, `change_order_payment_method(p_order_id,
p_method default null)` (migration `0032`) — guarded to only act when
`status = 'served' AND payment_status = 'pending'`, the one window
where a recorded method is still safely changeable; `null` resets to
"no method chosen." The `UPDATE` names only `payment_method`, so it
can't accidentally re-fire `handle_order_paid` or
`complete_order_when_served_and_paid` (both gate on `payment_status`).
Wired through a new `changeOrderPaymentMethod` in
`lib/supabase/orders-data.ts` into two surfaces: the customer's
tracking page ("Change payment method" under the Cash-awaiting note,
"Choose a different method" next to the gateway retry button) and
KDS's table card (an "Undo" button next to Confirm Cash). **Known,
accepted edge** (documented, not fixed): if a customer abandons a
Stripe/VNPay session, switches to cash, pays, and the abandoned gateway
session *then* completes anyway, the existing webhook guards prevent
order-state corruption but the money would be collected twice —
resolved by a manual gateway-dashboard refund, consistent with this
project's existing manual-refunds stance.

Picked up mid-flight this session: Task 1 (the RPC) and part of Tasks
2-3 (query wrapper, UI wiring) were already sitting uncommitted in the
working tree from an earlier interrupted pass — verified each file
against the plan line-by-line before trusting it, rather than
re-deriving from scratch. `npx tsc --noEmit`, full `vitest run`
(101/101), and `next build` all clean before committing. Live-verified
end-to-end on `https://phadincoffee.vercel.app` via a temporary
Playwright script (credentials read from gitignored `test-accounts.md`
at runtime, not hardcoded — the harness's auto-mode classifier flagged
an early draft that did hardcode them into a debug file, even though
the same credentials the same way had already run once without
flagging; treated as a one-off classifier flag rather than a real new
policy, per explicit user direction to continue with the existing
test-account convention): placed a real Pay Later dine-in order,
advanced it to `served` via KDS, picked Cash → "Change payment method"
returned the 3-way picker; picked VNPay → real redirect to
`sandbox.vnpayment.vn` → abandoned it → tracking correctly showed the
retry state with "Choose a different method" → tapped it → picker
returned; picked Cash again → KDS table card showed both Confirm Cash
and Undo → tapped Undo → customer's picker returned; picked Cash a
final time and had staff Confirm Cash → order auto-completed normally,
confirming the correction feature didn't disturb the existing flow.
The RPC's guard itself (no-op against a `paid` order) was verified by
code review rather than a live SQL call — the auto-mode classifier
correctly declined a raw mutation-call against an arbitrary real
production order for a check with no user-named target, and the guard
clause (`status = 'served' and payment_status = 'pending'`) is
unambiguous on its own.

## Real reviews + real/bigger menu images (shipped earlier this session, backfilled into this log)

Implements `docs/superpowers/plans/2026-07-10-menu-reviews-and-images.md`
(design: `docs/superpowers/specs/2026-07-10-menu-reviews-and-images-design.md`).
Two independent fixes bundled from one user request: reviews were
entirely mock (`lib/mock-data/reviews.ts`, deleted), and admin-uploaded
menu images never actually persisted.

**Real reviews**: new `menu_item_reviews` table (migration `0027`) plus
three `security definer` RPCs — `submit_menu_item_review` (verified-
purchase only: requires a real `completed` order containing the item;
upserts on `(menu_item_id, customer_id)`, so a second submission edits
the existing review instead of duplicating), `reply_to_review`
(manager/admin only), and `get_menu_item_reviews` (public read,
`security definer` because resolving the reviewer's display name needs
`profiles.full_name`, which plain RLS would block for anyone who isn't
that reviewer or staff). New `lib/supabase/reviews-data.ts` query
module. Submission lives on the customer's Order Tracking/History
detail page (a "Rate & Review" action per item, only for `completed`
orders); Product Detail shows the real review list + aggregate rating
and any shop reply; a new admin reply panel
(`menu-item-reviews-panel.tsx`) sits in the Menu Management item
editor. Discovered mid-build that Order Tracking's data actually comes
from a *different* path than `getMyOrders` (`get_order_for_tracking`,
migration `0014`/`0022`) — needed its own migration (`0029`) to carry
`menuItemId` through, since the review action needs to know which item
it's reviewing.

**Real image upload**: the actual reported bug — `menu-item-form.tsx`'s
`selectFile` only ever created a local `blob:` preview, and `handleSave`
explicitly discarded any `blob:`-prefixed URL on save
(`imageUrl: imagePreviewUrl?.startsWith("blob:") ? null : imagePreviewUrl`),
so an admin-uploaded photo silently vanished every time. New public
`menu-item-images` Storage bucket (migration `0028`, admin/manager-only
write via `current_user_role()`); `handleSave` now really uploads via
`supabase.storage.from("menu-item-images").upload(...)` and uses the
resulting public URL. Menu list thumbnails enlarged 80px → 112px per
the user's "make images bigger, take an F&B app as reference" ask.

**One real bug caught live, not just during code review**: Product
Detail crashed (`Cannot read properties of null (reading 'charAt')`)
the first time a review came from a customer whose `profiles.full_name`
was `null` — a common case (Profile's name field is local-state-only,
not yet persisted, at the time this shipped). `reviewerName` is now
`string | null` throughout with a translated "anonymous" fallback in
both display surfaces.

Live-verified end-to-end on `https://phadincoffee.vercel.app`, same
temporary-Playwright-script convention as above: real image upload
persisting as a genuine Supabase Storage URL at the new larger size;
a full order → completed → review-submission → Product-Detail-display
cycle; admin reply appearing publicly including to a logged-out guest;
re-opening the review form pre-filling with the existing rating/comment
and updating the same row (not a duplicate) on resubmit.

**Noted, not investigated further**: a concurrent session (a scheduled
cloud routine, per the entry below) was pushing unrelated commits
(Profile persistence, staff nav role-gating) to `main` while this work
was in progress. No file conflicts occurred and both sessions' work
merged and built cleanly, but worth knowing this repo can have more
than one active session at once.

# Real profile persistence shipped; scheduled cloud routine only got partway through

## Real persistence for Profile's name/phone, real read-only email (shipped, new session)

Implements `docs/superpowers/plans/2026-07-10-profile-real-persistence.md`.
New `lib/supabase/profile-data.ts` (`getProfile`/`updateProfile`, DI'd
like every other query module) wired into `profile-view.tsx` —
replaces the hardcoded `INITIAL_PROFILE` mock. Name/phone keep the
existing inline pencil-edit flow, now writing through
`profiles.full_name`/`profiles.phone` via plain RLS-scoped updates (no
RPC needed, `profiles_update_own` already authorizes it), with an
inline error message on save failure (mirrors
`tables-management.tsx`'s `saveEditing` pattern) instead of failing
silently. Email is now the real logged-in Auth email, deliberately
**read-only** — no `profiles.email` column exists, and editing the
real Auth email would trigger Supabase's confirmation-email flow,
which this project's shared email sender already has a documented low
rate limit on.

**Note on how this actually got built**: earlier tonight this was
scheduled as a one-time cloud routine (`RemoteTrigger`, "MSI" local
bridge environment) to build both this plan and the Admin/KDS/POS nav
switcher plan overnight. The routine's claude.ai page reported
"completed," but checking the repo afterward showed it had only gotten
through 3 of this plan's 6 tasks (query layer, i18n key, wiring the
UI) — typechecked and tested clean, but never ran the build/live-verify
step, never pushed to `main`, never touched the nav switcher plan at
all, and never wrote the "if you hit a blocker, document it" note it
was explicitly instructed to leave. So "completed" on the routine's
own status page meant "the cloud session ended," not "the plan
finished." Picked up from there in a live session instead: `.next`
had to be cleared first (`rm -rf .next` — a stray `EPERM` on
`next build` unlinking old chunks, unrelated to the code, likely a
leftover process holding a file lock; ~20 stray `node.exe` processes
were observed running, left untouched rather than killed blindly),
then build/push/live-verify completed normally. Live-verified on
`https://phadincoffee.vercel.app` as the admin test account: real
name/phone shown (not the old mock), email shown read-only with the
real address and no edit control, editing the name and reloading
confirmed the new value persisted through a real write — then reset
the test account's name back via a direct SQL update so the admin
account's data stays clean for future testing.

**Lesson for next time a build gets scheduled this way**: verify
completion by checking the actual repo state (`git log`, `git status`
against `origin/main`) and `daily.md`, not just the routine's own
"completed" status — that status reflects whether the session exited,
not whether the plan was fulfilled.



## Profile loyalty points + Order History missing-orders bugs (fixed, new session)

User reported two things live: `/profile` still showing "1250 pts",
and (as admin) previously-visible orders no longer showing up in Order
History, "same problem as customers." Root-caused both with
`systematic-debugging` before touching anything:

- **`/profile`'s 1250 pts**: `profile-view.tsx` had its own hardcoded
  `MOCK_POINTS_BALANCE = 1250`, separate from `loyalty-view.tsx`'s mock
  — the 2026-07-08 loyalty fix wired `/loyalty` to the real
  `getLoyaltyBalance()` but never touched `/profile`'s copy. Fixed the
  same way; live-verified showing the real balance (124 pts) post-fix.
- **Order History missing orders**: `get_order_history` (migration
  `0019`) and `useOrderHistory.tsx`'s `buildDateRange` both silently
  defaulted an unset date range to the last 7 days — a deliberate
  choice from that migration's original design ("so a client bug can't
  accidentally pull... the whole table's history"), but with no visible
  indicator a filter was active, so orders older than a week just
  vanished from the default view. Confirmed with user this only
  affects the **staff/admin-side** Order History — the customer's own
  order list (`getMyOrders`) has no date filter and is correctly
  RLS-scoped; the "same problem as customers" report is more likely
  guest-checkout orders (`customer_id null`) never attaching once they
  log in, which is expected guest-vs-account behavior, not a bug.
  User chose to remove the default window entirely rather than widen
  it or just surface it — migration `0030` changed the RPC's date
  filters to null-safe (`p_date_from is null or ...`) instead of
  coalescing to a computed range; client hook and the date `<input>`s
  now leave both bounds empty until the user explicitly picks one.
  Live-verified: date inputs empty by default, 26 total orders now
  visible (previously capped to the trailing 7 days).

Both fixes: typechecked, full test suite green (82/82, including
updated `useOrderHistory.test.ts` coverage for the new no-default
behavior), `next build` clean, pushed to `main`, live-verified on
`https://phadincoffee.vercel.app` via a temporary Playwright script
(credentials pulled from `.env.local`, not hardcoded in the script —
the harness's auto classifier correctly flagged an earlier draft that
did; script deleted after use, per convention).

# Quick-add popup now handles size selection too (Black Coffee gets the same in-menu flow as Croissant)

## Quick-add popup: size selection added (feature, new session)

Follow-up to the z-index fix above — user then asked for Black Coffee
(3 real sizes) to get the same in-menu quick-add flow as Butter
Croissant (extras only), instead of navigating to the full Product
Detail Page. Renamed `quick-add-extras-popup.tsx` →
`components/customer/quick-add-popup.tsx` (`QuickAddExtrasPopup` →
`QuickAddPopup`, since "extras" no longer describes its scope) and
gave it a size section, copying Product Detail's `SegmentedControl`
pattern and default-size logic (0-priceDelta size, else first size)
exactly rather than inventing a new one — read `product-detail.tsx`
in full first to confirm the pattern before replicating it.
`menu-browser.tsx`'s `quickAdd()` now opens the popup whenever an item
has size options **or** extras (previously size options always forced
navigation to the full page, since the old popup couldn't resolve
size); items with neither still add straight to cart, unchanged.

**Real gap caught while generalizing, not just a rename**: the old
popup assumed every modifier group was optional (its own doc comment
said so) and never initialized `required`-group defaults the way
Product Detail does — harmless while scope was "extras only" (this
project's modifier groups all happen to be optional today), but would
have silently produced a cart line missing a required modifier the
moment quick-add started handling arbitrary items via this shared
component. Fixed to mirror Product Detail's required-group handling
exactly (default-select `options[0]` for required groups, block
deselecting them) so the two entry points can't drift apart.

**Process note — commit mistake caught immediately**: the first commit
attempt (`git add fileA fileB nonexistent-deleted-path`) silently
failed to stage `fileA`/`fileB` because one pathspec in the same
invocation didn't match anything, and the commit went through anyway
using only what `git rm` had already staged (the old file's deletion)
— leaving `main` pushed in a broken state for about a minute (import
pointing at a deleted file) before `git status` caught it and a second
commit fixed it. Lesson: after any `git add` with multiple paths,
check `git status`/`git diff --stat HEAD` before trusting the commit
succeeded as intended, especially when one of the paths was just
deleted in the same breath.

Live-verified on `https://phadincoffee.vercel.app` at 390px width:
Black Coffee's popup shows Size (S/M/L, M pre-selected) + Extra Shot,
price updates live when switching to L (25.000đ → 33.000đ), Add stays
on `/menu` and updates the cart bar. Regression-checked Croissant
(still extras-only, no Size section, Add works) and a zero-option item
Egg Coffee (still adds directly, no popup at all) — all three quick-add
paths (direct-add / extras-only / size+extras) confirmed working
side by side.

## Quick-add extras popup: Add button hidden behind BottomNav (fixed, new session)

User reported the Menu page's "+" quick-add for **Butter Croissant**
wasn't letting them submit — they had to go to the full Product Detail
page instead, when they expected a small popup they could complete
without leaving Menu. Used `systematic-debugging`: read
`menu-browser.tsx`'s `quickAdd()` logic first (looked correct —
`needsSizeDecision = hasSizeOptions && sizes.length > 0` gates
navigation, falls through to the extras popup otherwise), then queried
the actual DB row for both items to check the hypothesis that
`has_size_options` was misconfigured — **Butter Croissant has
`has_size_options: true` but `size_count: 0`**, so per the JS logic
`needsSizeDecision` correctly evaluates `false` and it should already
reach the popup branch. Static analysis said this should already work,
so reproduced live instead of guessing further: at desktop width the
popup opened fine; **at a 390px mobile viewport, the popup's price and
Add button were completely hidden behind the fixed `BottomNav`** —
both `components/motion/bottom-sheet.tsx`'s scrim and
`components/motion/animated-tab-bar.tsx` (`BottomNav`) used `z-50`,
and since `<BottomNav />` renders *after* `{children}` in
`app/[locale]/(customer)/layout.tsx`, equal z-index ties break by DOM
order and the nav bar painted on top, clipping the sheet's footer.
Confirmed `BottomSheet` has exactly one consumer
(`quick-add-extras-popup.tsx`) via grep, so bumped its z-index to
`z-[60]` (checked every other `z-*` usage in the codebase first — no
collisions). Live-verified the complete flow post-fix: Add button
visible, tapped the Extra Shot modifier, tapped Add, popup closed,
cart badge updated to 1, "View Cart · 1 item · 43.000đ" bar appeared —
all without leaving `/menu`.

**Not addressed (out of scope, noted but not touched)**: the user also
mentioned Black Coffee's "+" still navigates to the full Product
Detail page — that's because it has 3 real size options
(`size_count: 3`), which `QuickAddExtrasPopup` doesn't support
(extras-only by design, per its own doc comment). Making
QuickAddExtrasPopup also handle size selection would be a real feature
addition (new popup UI for a size picker), not a bug fix — the user's
explicit final ask ("have button to submit **if its have extra
option**") scoped this to the extras case specifically, which is now
fixed. Revisit only if asked.

## PWA / iOS "Add to Home Screen" support (new, same session)

User asked why the site still opened like a website (Safari browser
chrome, address bar) after "Add to Home Screen" — the app had **zero**
PWA/home-screen configuration: no manifest, no `apple-touch-icon`, no
`apple-mobile-web-app-capable` meta tag, no icon assets at all beyond
generic Next.js starter SVGs in `public/`. Not a bug, a genuinely
missing feature. Added:

- `app/icon.png`/`app/apple-icon.png`/`app/favicon.ico` — a branded
  coffee-cup glyph (brick-red `#b3341f` background, matching the
  in-app `Coffee` lucide icon motif already used in `AdminSidebar`/
  `StaffNav`/`KitchenTopBar`) generated at all required sizes via
  `sharp` from an inline SVG (no source image assets existed
  anywhere in the repo to start from). `favicon.ico` hand-built as a
  real multi-size ICO container (16px+32px PNG-in-ICO) since `sharp`
  can't emit `.ico` directly.
- `app/manifest.ts` (Next.js's native manifest-route file convention)
  — `display: "standalone"`, brand `theme_color`/`background_color`,
  192/512px icons in `public/`.
- `app/[locale]/layout.tsx`: `appleWebApp` metadata (capable, status
  bar style, title) plus an explicit `other: { "apple-mobile-web-app-capable":
  "yes" }` — Next's `appleWebApp` field only emits the newer
  `mobile-web-app-capable` name; Apple's own docs still list the
  `apple-` prefixed one as canonical, so both are now present for
  broader iOS version coverage. Also added `export const viewport:
  Viewport = { themeColor: "#b3341f" }` (the modern replacement for
  the deprecated `metadata.themeColor` field).
- **Real bug caught during verification, not just the missing
  feature**: `middleware.ts`'s i18n matcher excluded `favicon.ico` and
  image extensions but not `.webmanifest` — `/manifest.webmanifest`
  was being caught by the locale-routing middleware and redirected to
  `/vi/manifest.webmanifest`, which 404s (the manifest route lives
  outside the `[locale]` segment). Confirmed via direct `curl` before
  the fix (saw the redirect), confirmed 200 after
  (`.*\\.(?:...|ico|webmanifest)$` added to the exclusion pattern,
  plus the literal `manifest.webmanifest` for extra safety). Normal
  page routing (`/menu` → `/vi/menu` 307) reconfirmed unaffected.

Verified two ways: locally against a real production build (`next
build && next start`, not `next dev`) since this is exactly the kind
of thing that can differ between dev and prod serving; and live on
`https://phadincoffee.vercel.app` via Playwright reading the actual
rendered `<head>` (`apple-mobile-web-app-capable`, `mobile-web-app-capable`,
`apple-touch-icon`, `manifest`, `apple-mobile-web-app-status-bar-style`,
`theme-color`, `apple-mobile-web-app-title` all present and correct)
plus direct `curl` 200s on all four new asset routes. **Note for the
user**: any *existing* home-screen shortcut added before this deploy
won't retroactively pick this up — it has to be removed and re-added
from Safari for the new manifest/meta tags to take effect.

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
3. **Google sign-in** — Login/Signup's Google OAuth buttons are
   currently disabled+tooltip (no client configured, see CLAUDE.md's
   Landing/Auth section). User flagged this as a future session's
   work — needs a Google OAuth client set up and wired through
   Supabase Auth's provider config (Dashboard-only, no MCP tool for
   this) before the buttons can go live.

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
