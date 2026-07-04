# Today: Brand theme wired

## Task

Replaced shadcn's default gray theme with the real PhaDinCoffee brand:
brick red / coffee brown / caramel / warm cream palette and Be Vietnam Pro
font, sourced from the approved Stitch design system. Also fixed a latent
bug where `--font-sans` was circularly self-referencing and silently never
applying a custom font at all.

## Context

- Full details: `continuity.md` ("Theme wired" section), `CLAUDE.md` ("Theme" section)
- Source of truth for colors: `design/stitch-exports/` (Stitch design system)
- Changed files: `app/globals.css`, `app/[locale]/layout.tsx`

## Done when

- `npm run build` succeeds — done
- Compiled CSS contains `--primary: #b3341f` (light) / `#e0533a` (dark) and
  `--font-sans` resolves to "Be Vietnam Pro" — done, verified via curl against
  the dev server's compiled CSS chunk
- Next session starts on: porting Stitch page designs into real components,
  starting with the customer flow (Menu → Cart → Checkout → Order Tracking)
