# Today: Backend setup started — real Supabase project connected, migrations written but not yet applied

## Task

User asked to start working with the backend. Chose a hosted Supabase
project (no Docker/CLI) over local Supabase, then connected the official
Supabase MCP server so Claude can run migrations/queries directly instead
of manual copy-paste into the Dashboard's SQL Editor.

## Done this session

- Wrote real SQL into all 7 `supabase/migrations/*.sql` files (previously
  comment-only stubs) — full schema from
  `docs/superpowers/plans/2026-07-04-coffee-shop-scaffold.md` Tasks 3-9.
  **Committed** (`b447a05`), but **not yet applied** to the live database.
- Created a real Supabase project: `qhiypdqnrnzndxdwqxbx` (hosted,
  supabase.com). Project uses the newer key naming — **publishable key**,
  not the legacy "anon key".
- `.env.local` filled in with the real `NEXT_PUBLIC_SUPABASE_URL` +
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (gitignored, not committed).
  `.env.local.example` updated to match the new var names.
- Renamed `NEXT_PUBLIC_SUPABASE_ANON_KEY` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  everywhere it's read: `lib/supabase/client.ts`, `lib/supabase/server.ts`,
  `middleware.ts`.
- **Reverted the TEMP-LOCAL-PREVIEW-ONLY `role = "admin"` bypass** in
  `middleware.ts` back to the real `await resolveRole(request)` — no
  longer needed now that a real Supabase project exists to test against.
- Verified real connectivity (not just "env vars present"): curl against
  the Supabase REST endpoint directly confirmed the URL/key are valid
  (`{"message":"Secret API key required"...}` on the root endpoint — a
  real Supabase response, not a DNS/network failure), and confirmed the
  migrations genuinely haven't run yet (`PGRST205: Could not find the
  table 'public.profiles'`).
- Connected the **Supabase MCP server**: `claude mcp add --scope project
  --transport http supabase "https://mcp.supabase.com/mcp?project_ref=qhiypdqnrnzndxdwqxbx&features=..."`
  → wrote `.mcp.json` (no secrets in it, safe to commit — auth is a
  separate OAuth flow, not embedded in the URL). User authenticated via
  `claude /mcp` in a separate terminal. `claude mcp list` confirms both
  `stitch-mcp` and `supabase` show **✔ Connected**.

## Known gap / why this session ended here

MCP tool discovery happens at session start — this session was already
running before the Supabase MCP server finished connecting, so no
`mcp__supabase__*` tools ever became available here (`ToolSearch` for
"supabase", "mcp", "execute_sql" all came back empty, despite `claude mcp
list` showing it connected). **User is starting a fresh session for this
reason** — a new session should discover the Supabase MCP tools immediately.

## Next session starts here

1. Confirm `mcp__supabase__*` tools are available (they should be, in a
   fresh session — if not, something is off with the MCP config and it's
   worth re-checking `claude mcp list`).
2. Use those tools to run the 7 migrations in `supabase/migrations/`
   **in order** (0001 through 0007) against the live
   `qhiypdqnrnzndxdwqxbx` project. Watch for `gen_random_uuid()`/
   `gen_random_bytes()` needing `create extension if not exists pgcrypto;`
   first if either errors.
3. Verify: list tables, confirm all expected tables from Tasks 3-9 exist
   (`profiles`, `menu_items`, `orders`, etc.), each with RLS enabled.
4. Create a real admin profile (sign up a test user, then manually set
   its `profiles.role` to `'admin'` via SQL) so `/admin/*` and `/staff/*`
   can finally be tested with a **real** authenticated session instead of
   curl-only anonymous-redirect checks.
5. Start replacing mock data sources with real Supabase queries, one hook
   at a time (suggest starting with `lib/mock-data/menu.ts` → Menu/POS/
   Admin Menu, since it's the most-referenced one) — do NOT do this until
   steps 1-4 are confirmed working, to avoid building against a schema
   that isn't actually live yet.
