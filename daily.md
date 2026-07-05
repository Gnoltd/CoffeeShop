# Today: Kitchen Display full layout parity with the Stitch mockup

## Task

User asked if KDS can connect to real orders, and to verify it matches
the Stitch design 1:1 (time count, table, orders, statuses, current load,
queue, wait time). Found a real gap: no Bottom Stats Bar existed at all,
and the sidebar/richer top bar had been deliberately dropped earlier.
Confirmed with the user to go for full layout match, then built it.

## Context

- Full details: `continuity.md` ("Kitchen Display full layout parity"
  section), `CLAUDE.md` (same, under "Staff pages")
- New: `components/staff/{kitchen-top-bar,kitchen-sidebar,
  kitchen-board,kitchen-stats-footer}.tsx`
- Changed: `components/staff/kitchen-display.tsx` (now an orchestrator),
  `app/[locale]/staff/layout.tsx` + `pos/page.tsx` (StaffNav moved to POS
  only), `app/[locale]/staff/orders/page.tsx`

## Done when

- `npm run build` succeeds, no type errors — done
- curl confirms the new sidebar/top-bar/stats-bar text renders in both
  locales on `/staff/orders` — done
- POS (`/staff/pos`) still shows its original nav, unaffected — done
- `/staff/*` auth gate unaffected — done
- Current Load / Queue / Wait Time are real computed values from the
  order list, not mock numbers — done
- Shift Stats (Completed / Avg Time) genuinely track session completions
  instead of a static mock "42" — done
- Not click-tested in a real browser — no browser automation tool
  available in this environment, standing caveat for the whole project

## Next session

Still nothing left on the frontend that isn't a documented, intentional
gap. Backend is next — Supabase DB schema/RLS/Edge Functions, then wire
Kitchen Display to a real Realtime `orders` subscription (the board/
footer/sidebar are already structured to just consume whatever `orders`
array they're given, so this should be a contained change).
