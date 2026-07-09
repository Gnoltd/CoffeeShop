# Next up: continue POS mobile-adaptive redesign (brainstorming in progress)

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

Next session (or rest of this one): build the three mobile layouts by
hand, using the existing desktop Stitch exports
(`design/stitch-exports/10-staff-pos.html`,
`11-staff-kitchen-display.html`, `12-admin-dashboard.html`) and this
project's brand tokens as visual reference — no live Stitch generation.
Design decisions already locked in above (POS Menu⇄Order page-swap,
KDS segmented-control column switcher, Admin hamburger drawer) still
apply as-is; skip straight to writing the design spec doc(s) per
sub-project (starting with POS) and hand off to writing-plans, same
convention as every other feature in this project.

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
