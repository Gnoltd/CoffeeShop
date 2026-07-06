# Real Table Data + Realtime — Design Spec

**Date:** 2026-07-06
**Status:** Approved, ready for implementation planning.

## Context

Second sub-project of the "make all data real-time" initiative
(`daily.md`'s decomposition: Inventory → **Tables** → Orders → Staff
accounts). Replaces `hooks/useTables.tsx`'s `localStorage` mock model with
real Supabase data and cross-session Realtime sync, following the same
shape as the Inventory sub-project
(`docs/superpowers/specs/2026-07-06-inventory-realtime-design.md`).

### What already exists (migration `0005_orders.sql`, applied)

- `public.tables` — `id uuid pk`, `table_number text not null unique`,
  `qr_code_token text not null unique default encode(gen_random_bytes(16),
  'hex')`. RLS: `tables_select_all` (`using (true)` — anyone, including an
  unauthenticated guest scanning a QR code, can read every table row);
  `tables_admin_all` (`manager|admin` only, all operations).
- `public.orders.table_id` already has a foreign key into `public.tables`
  — Tables is already positioned as a dependency of the still-pending
  Orders sub-project.
- The `qr_code_token` default is already a proper opaque random 32-char
  hex string generated server-side — better than the mock's
  `Math.random().toString(36).slice(2, 10)` 8-char token, and needs no
  change.

### What's missing (the actual gap)

1. No `location_vi`/`location_en`, `is_occupied`, or scan-count columns —
   `hooks/useTables.tsx`'s mock `TableRecord` has all four, none of which
   exist on the real table.
2. No admin UI to create a table (mock's `addTable()` auto-increments a
   local array; a real `table_number unique` constraint means an admin
   must supply a number, and the UI must handle a collision).
3. No Realtime.
4. **A real RLS wrinkle, not present in the Inventory sub-project:**
   scan-count tracking must be writable by a **guest** — `/table/[qrToken]`
   is reached by literally scanning a printed code with a phone's camera
   app, with no login involved (see CLAUDE.md's Landing section: "no
   camera-based QR scanning implemented... customers reach
   `/table/[qrToken]` by scanning a printed code"). `tables_admin_all`
   would block any guest write. Inventory's `adjust_ingredient_stock` RPC
   could safely use `security invoker` because only manager/admin ever
   call it; a table-scan increment cannot use the same approach.

## Scope

One implementation plan (schema → query layer → hook → UI → verification),
same reasoning as the Inventory plan: every piece is a dependency of the
next, not an independent subsystem.

**In scope:** bilingual location columns, `is_occupied`, atomic scan-count
increment (guest-writable), atomic QR-token regeneration (admin-only),
Realtime, `lib/supabase/tables-data.ts` query layer, `hooks/useTables.tsx`
rewrite, a new "Add Table" admin UI, and updating `table-landing.tsx` for
the now-async table lookup.

**Out of scope:** anything involving `orders.table_id` itself (that's the
Orders sub-project). This spec only makes sure `tables` rows are real and
live — it doesn't touch order placement.

## Architecture

### 1. Schema — `supabase/migrations/0012_tables_i18n_and_scan_fn.sql`

- `tables` gains `location_vi text not null default ''`, `location_en
  text not null default ''`, `is_occupied boolean not null default
  false`, `scan_count integer not null default 0`.
- `public.increment_table_scan_count(p_table_id uuid) returns
  public.tables` — **`security definer`**, the one function in this
  project that needs it. A guest with no `profiles` row and no role
  reaches `/table/[qrToken]` and must be able to record a scan;
  `tables_admin_all` would otherwise block any write from that session.
  Scoped narrowly: the function body only ever does `update public.tables
  set scan_count = scan_count + 1 where id = p_table_id returning *` —
  it takes no other parameters and touches no other column, so it cannot
  be used to rename a table, change its location, or regenerate its QR
  token as a privilege-escalation path. `grant execute ... to anon,
  authenticated` (both — a guest may not even hold an `authenticated`
  Supabase session role depending on how anonymous access is configured;
  granting both is the safe default and costs nothing since the function
  does only this one narrow write).
- `public.regenerate_table_qr_token(p_table_id uuid) returns
  public.tables` — `security invoker` (only ever called by an admin, so
  `tables_admin_all` already gates it correctly, matching
  `adjust_ingredient_stock`'s reasoning). Generates
  `encode(gen_random_bytes(16), 'hex')` server-side rather than a
  client-generated token — consistent with the column's own insert-time
  default, and avoids trusting `Math.random()`/`crypto` in the browser
  for something that must be unique and hard to guess.
  `grant execute ... to authenticated` only.
- Add `tables` to the `supabase_realtime` publication.

### 2. Query layer — new `lib/supabase/tables-data.ts`

Same DI convention as `menu-data.ts`/`inventory-data.ts`.

```ts
export type TableRecord = {
  id: string
  number: string
  qrToken: string
  locationVi: string
  locationEn: string
  isOccupied: boolean
  scanCount: number
}

export type TableInput = { number: string; locationVi: string; locationEn: string }

export async function getTables(supabase): Promise<TableRecord[]>
export async function createTable(supabase, input: TableInput): Promise<TableRecord>
export async function renameTable(supabase, id: string, number: string): Promise<TableRecord>
export async function updateTableLocation(supabase, id: string, locationVi: string, locationEn: string): Promise<TableRecord>
export async function setTableOccupied(supabase, id: string, isOccupied: boolean): Promise<TableRecord>
export async function regenerateQrToken(supabase, id: string): Promise<TableRecord>
export async function incrementScanCount(supabase, id: string): Promise<TableRecord>
export async function getTableByToken(supabase, token: string): Promise<TableRecord | null>
```

- `createTable` inserts `table_number` directly from admin input (not
  auto-computed) — if it collides with the `unique` constraint, the
  insert throws and the caller surfaces a real "that table number is
  already taken" error (see Error Handling below) rather than silently
  overwriting or guessing a different number.
- `regenerateQrToken`/`incrementScanCount` both call their respective RPC
  via `supabase.rpc(...)`, same shape as `inventory-data.ts`'s
  `adjustStock`.
- `getTableByToken` is a plain `.select(...).eq("qr_code_token",
  token).maybeSingle()` — covered by the public `tables_select_all`
  policy, so it works for a logged-out guest exactly like it needs to.

### 3. `hooks/useTables.tsx` — rewritten

The `tables` **list** (the directory of every table) drops `localStorage`
entirely: fetches `getTables()` once on mount, subscribes to
`postgres_changes` on `tables`, and every mutation (`addTable`,
`renameTable`, `updateLocation`, `toggleOccupied`, `regenerateToken`)
relies on the Realtime echo to update local state rather than calling
`setTables` itself — identical reasoning to Inventory's "one code path
that updates state" note.

**`activeTable` (a single browser tab's "which table am I ordering at"
session) keeps its existing `localStorage` persistence, unchanged.** This
is a correction from an earlier draft of this design, which assumed
`activeTable` could just become plain React state now that its source
data is real. That's wrong: the `localStorage` write for `activeTable`
was added in an *earlier* session specifically so a customer's dine-in
context survives a VI/EN language switch — `[locale]` being a dynamic
route segment means switching it remounts every provider under
`app/[locale]/layout.tsx`, wiping any non-persisted state (this exact bug
class hit `useInventory.tsx` two sessions ago). Dropping `activeTable`'s
persistence now would silently regress that already-fixed behavior: a
customer who scans a table's QR code and then taps "EN" would fall back
to guest/pickup checkout with no table context. So: `tables` (the list)
becomes Supabase+Realtime-backed like Inventory; `activeTable` (the
per-tab session) stays exactly as it works today, just holding a
`TableRecord` shape that originated from a real DB row instead of a mock
array entry.

**The one real behavioral change:** `setActiveTableByToken` becomes
`async function setActiveTableByToken(token: string): Promise<TableRecord
| null>` — it calls `getTableByToken(supabase, token)` (a real query, not
a local array `.find`), and on a match also calls `incrementScanCount`
(fire-and-forget is fine here — the count updating a moment after the
page renders "You're ordering at Table N" is an acceptable, honest
trade-off; the page's own success/failure doesn't depend on the count
having landed yet), then persists the resolved table to
`localStorage` exactly like the current `setActiveTable` call already
does.

**Existing documented gap resolves itself, no new code needed:** "QR
token regeneration doesn't invalidate an already-active session" was
previously true only because everything was one shared local array in
`localStorage`. With a real backend, a customer's `activeTable` is a
value resolved once at scan time and held in that tab's memory — an
admin regenerating the token afterward doesn't retroactively change what
that customer already has, which is the *correct* behavior (mirrors a
real reprinted QR sticker not affecting someone already seated), not a
bug to fix. Worth stating explicitly so this isn't miscategorized as
still-open work later.

### 4. `components/customer/table-landing.tsx` — updated for async lookup

```tsx
useEffect(() => {
  let cancelled = false
  setActiveTableByToken(qrToken).then((table) => {
    if (!cancelled) setResolvedTable(table)
  })
  return () => {
    cancelled = true
  }
}, [qrToken])
```

Replaces the current synchronous `setResolvedTable(setActiveTableByToken(qrToken))`
call. The rest of the component (loading/invalid/success states) is
unchanged — `resolvedTable === undefined` already means "still
resolving," which now covers real network latency instead of a
synchronous call that always resolved on the same tick.

### 5. Admin UI (`components/admin/tables-management.tsx`)

- New "+ Add Table" button opens a small modal
  (`components/admin/table-form.tsx`, same pattern as
  `ingredient-form.tsx`): table number + optional location (VI/EN)
  inputs. A unique-constraint violation from `createTable` surfaces as an
  inline error (`t("tableNumberTakenError")`), not a silent failure.
- Rename/location-edit/occupied-toggle/download-QR/regenerate-code all
  keep their current inline UX (no new modals) — just call the new async
  mutation functions instead of the old synchronous local-state setters.
  `regenerateToken`'s button already exists; it now calls the real RPC
  and the QR code re-renders (the `useEffect` that regenerates the
  `qrCodes` data-URL map already depends on `tables`, so a new token
  flowing in via Realtime automatically produces a new QR image with no
  extra code).

### 6. Other consumers

`components/customer/checkout-view.tsx` (reads `activeTable`, which is
unaffected by this whole sub-project per Section 3 above) needs no
change at all.

`components/staff/pos-terminal.tsx` needs one real, small fix: `const
[selectedTableId, setSelectedTableId] = useState(tables[0]?.id ?? "")`
initializes from `tables` at first render — when `tables` is real and
async, it's still `[]` at that moment, so `selectedTableId` starts `""`
and never updates itself once the real list loads (the existing fallback
`tables.find(...) ?? tables[0]` means the *logic* still resolves
correctly to the first table internally, but the `<select value=
{selectedTableId}>` at line 256 renders with no option visibly selected,
since `""` matches none of the real UUID option values). Fix: add a
`useEffect` that sets `selectedTableId` to `tables[0].id` once `tables`
finishes loading and `selectedTableId` is still empty — a one-line
guard, not a redesign, but a real fix rather than a hedge.

## Data Flow

1. A customer scans a table's printed QR code → `/table/{token}` →
   `table-landing.tsx` calls `setActiveTableByToken(token)` → real
   `getTableByToken` query (public read) resolves the table, then
   `incrementScanCount` (guest-writable via the `security definer` RPC)
   fires.
2. Postgres's replication stream emits the `scan_count` `UPDATE` on
   `tables`; every subscribed admin session (e.g. Admin Tables open in
   another tab) sees the new scan total live, same mechanism as
   Inventory's stock updates.
3. An admin renaming a table, editing its location, toggling occupied, or
   regenerating its QR code triggers the same real update → Realtime
   → every other open admin session (and, since `tables_select_all` is
   public, a customer's own already-resolved `activeTable` — though as
   noted above, an already-active customer session doesn't need to react
   to this; it already has what it needs).

## Error Handling

- `createTable` failing on a duplicate `table_number` surfaces as
  `t("tableNumberTakenError")` inline in the Add Table modal, not a
  console-only failure.
- Realtime subscribe failure (same as Inventory) degrades to
  "fetched-once, not live" with a `console.warn`, not a crash.
- `getTableByToken` returning no match (stale/regenerated QR code) is
  **not an error** — it's the existing, correct "Invalid Table Code"
  screen in `table-landing.tsx`, unchanged by this work.
- `incrementScanCount` failing (e.g. transient network issue on a
  guest's phone) is swallowed, not surfaced to the customer — a missed
  scan-count increment is a cosmetic admin-stat miss, not something worth
  showing an error screen to a guest over. Table resolution itself
  (`getTableByToken`) still must succeed or fail normally, since that's
  what actually gates the customer's experience.

## Testing

- `lib/supabase/tables-data.test.ts` (new, same fake-Supabase-client
  style as `inventory-data.test.ts`): mapping correctness for
  `getTables`/`getTableByToken`, that `regenerateQrToken`/
  `incrementScanCount` call their respective `.rpc(...)` with the right
  argument names, and that `createTable` inserts the right snake_case
  columns.
- Realtime itself is verified live via Playwright, same convention as
  Inventory: two admin sessions, one renames/edits/regenerates a table,
  confirm the other sees it within about a second with no reload; a
  separate guest-context check that scanning
  `/table/{realToken}` increments `scan_count` (verified via
  `execute_sql`) without needing to be logged in at all.

## Self-Review Notes

- Checked for placeholders/TBDs — none found.
- Checked internal consistency — the `security definer` vs. `security
  invoker` distinction is justified once (Section 1) and referenced
  consistently in Data Flow/Error Handling rather than restated
  differently.
- Checked scope — confirmed this stays one plan; every piece depends on
  the schema existing first, not an independent subsystem.
- Confirmed the previously-documented "QR regen doesn't invalidate an
  active session" gap is correctly resolved as "working as intended,"
  not silently dropped — stated explicitly in Section 3 so a future
  session doesn't rediscover it as if it were still open.
