# Today: Real Next.js scaffold

## Task

Turned the folder/file skeleton into a real, running Next.js app: ran
`create-next-app`, merged it into the existing structure without disturbing
CLAUDE.md/continuity.md/the skeleton, added shadcn/ui, installed Supabase
client packages, implemented `middleware.ts` and `lib/supabase/*` for real,
and upgraded every placeholder page from a bare comment to a minimal valid
component so the app actually builds and runs.

## Context

- Spec: `docs/superpowers/specs/2026-07-04-coffee-shop-app-design.md`
- Plan: `docs/superpowers/plans/2026-07-04-coffee-shop-scaffold.md`
- Stitch exports (next thing to port into these pages): `design/stitch-exports/`

## Done when

- `npm run build` succeeds with 20 routes, no duplicate-route errors — done
- `npm run dev` serves public/customer routes (200) and redirects
  `/staff/*`/`/admin/*` to `/login` when anonymous (307) — done, verified with curl
- `continuity.md` reflects the current (real-scaffold) state — done
