# Today: Bilingual app + Food Cost Calculator

## Task

Made the app genuinely bilingual (not just translated copy) with a working
VI/EN switcher via next-intl, migrated all 20 routes to locale-prefixed
paths, fixed a real locale-caching bug found during verification, and built
the first real (non-placeholder) feature: a Food Cost % Calculator for admin.

## Context

- Spec: `docs/superpowers/specs/2026-07-04-coffee-shop-app-design.md`
- Plan: `docs/superpowers/plans/2026-07-04-coffee-shop-scaffold.md`
- Full details of what changed and why: `continuity.md`, `CLAUDE.md`
  ("Bilingual (i18n)" and "Food Cost Calculator" sections)

## Done when

- `npm run build` succeeds with 20 locale-prefixed routes — done
- `/vi/*` and `/en/*` render genuinely different-language content (verified
  after fixing the route-cache bug, not just before it) — done
- Anonymous visitors to protected routes redirect to the *same-locale*
  `/login` (e.g. `/en/admin/dashboard` → `/en/login`) — done, verified with curl
- Food Cost Calculator matches the sample calculation (125.000.000đ /
  31.3% / "Bình Thường") and is fully bilingual — verified server-rendered
  output for both locales; interactive click-through not verified (no
  browser automation tool available in this environment)
- `CLAUDE.md` and `continuity.md` reflect the current state, including the
  two things worth remembering: middleware is required for i18n (not just
  auth), and don't hardcode role bypasses in middleware even temporarily
