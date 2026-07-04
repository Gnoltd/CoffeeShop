# Today: Brand rename, next up is FE theming

## Task

Renamed the app from generic "Coffee Shop" to "PhaDinCoffee" (same name in
both languages — messages, marketing header, page title, `package.json`,
README, CLAUDE.md; also fixed `package.json`'s leftover `coffeeshop-tmp`
name from the initial scaffold). Confirmed with the user that bilingual
means single-language-per-page + toggle, not the dual-language-at-once
display shown in the earlier Stitch mockups. Agreed FE priority order:
theme tokens → customer flow pages → staff pages → admin pages.

## Context

- Full details: `continuity.md` ("Brand rename" and "Next steps" sections), `CLAUDE.md`
- Design source for the next step: `design/stitch-exports/` (17 exact HTML exports)

## Done when

- "PhaDinCoffee" appears consistently in both `messages/vi.json` and
  `messages/en.json`, plus the marketing header and page `<title>` — done
- `package.json` name fixed from `coffeeshop-tmp` to `phadincoffee` — done
- Next session starts on: wiring the Stitch brick-red/brown/cream palette +
  Be Vietnam Pro font into `app/globals.css`'s Tailwind v4 `@theme` block,
  before touching any individual page
