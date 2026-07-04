# Today: Landing, Auth, Order History, Loyalty, Profile — last 6 placeholder pages closed out

## Task

The user caught that Order History, Loyalty, and Profile "just show a word,
no function" while previewing the app — turned out those three, plus
Landing, Login, and Signup, were still the original create-next-app
placeholders despite earlier notes claiming every page was real. Checked
Stitch for existing mockups (found 5 of 6 already designed but unported;
generated a new one for Order History), reported the findings, then built
all 6 for real.

## Context

- Full details: `continuity.md` ("Landing, Auth & remaining customer
  pages" section), `CLAUDE.md` (same section name)
- New: `components/marketing/landing-view.tsx`,
  `components/customer/{order-history,loyalty-view,profile-view}.tsx`,
  `components/auth/{login-form,signup-form,google-icon}.tsx`
- Structural: `CartProvider` promoted to the root layout so
  `(marketing)`/`(auth)` route groups can reuse `CustomerHeader`/`BottomNav`
- Updated: `messages/vi.json` + `messages/en.json` (new namespaces:
  `OrderHistory`, `Loyalty`, `Profile`; expanded `Landing`, `Auth`)

## Done when

- `npm run build` succeeds, no type errors — done
- curl confirms real bilingual content (not the old placeholder heading) on
  `/`, `/login`, `/signup`, `/orders`, `/loyalty`, `/profile` in both
  locales — done
- No regression on `/admin/*` `/staff/*` anonymous-redirect gate — done
- Login/Signup submit + Google buttons are disabled+tooltip (explicit
  decision with the user — no Supabase Auth yet, don't fake a login) — done
- Not click-tested in a real browser — no browser automation tool available
  in this environment, same caveat as every other page this project

## Next session

Genuinely nothing left on the frontend now — every route in the app is
real, interactive UI. Backend is next: Supabase DB schema/RLS/Edge
Functions per the implementation plan, then replace every mock data source
listed in continuity.md with real queries (+ Realtime where noted), then
re-enable the disabled Login/Signup/Admin-Add/etc. buttons as their real
tables/auth land.
