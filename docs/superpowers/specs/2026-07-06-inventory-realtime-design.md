# Real Inventory Data + Recipes — Design Spec

**Date:** 2026-07-06
**Status:** Approved, ready for implementation planning.

## Context

This is the first sub-project of the larger "make all data real-time"
initiative (`daily.md`'s decomposition: Inventory → Tables → Orders →
Staff accounts). It replaces `hooks/useInventory.tsx`'s local
`useState`+`localStorage` mock model with real Supabase-backed data, adds
Realtime sync across sessions, and closes a gap found while scoping this:
there is currently **no way to define what ingredients a menu item or
extra actually consumes**, even though the schema and an order-paid
deduction trigger for exactly that already exist and are already applied
to the live project.

### What already exists (migration `0004_inventory.sql`, applied)

- `public.ingredients` — `id uuid pk`, `name text not null`, `unit text
  not null`, `stock_quantity numeric(10,2) not null default 0`,
  `low_stock_threshold numeric(10,2) not null default 0`. RLS: select for
  `staff|manager|admin`, all other operations for `manager|admin`.
- `public.menu_item_ingredients` — `(menu_item_id, ingredient_id)` pk,
  `quantity_used numeric(10,2) not null`. Same RLS shape.
- `public.modifier_ingredients` — `(modifier_id, ingredient_id)` pk,
  `quantity_used numeric(10,2) not null`. Same RLS shape.
- `public.inventory_logs` — `id`, `ingredient_id`, `change_quantity
  numeric(10,2) not null`, `reason inventory_log_reason` (enum:
  `order_deduction | restock | adjustment | waste`), `reference_order_id
  uuid` (FK added in `0005_orders.sql`), `created_by uuid references
  profiles(id)`, `created_at timestamptz`. Same RLS shape.
- `0007_handle_order_paid.sql` — a trigger that, when an order's status
  becomes `paid`, walks that order's items' `menu_item_ingredients` and
  `modifier_ingredients`, decrements `ingredients.stock_quantity`
  accordingly, and inserts an `order_deduction` log row per ingredient
  touched. **This won't actually fire until real order placement exists**
  (sub-project #3, "Orders") — it's dead code today, but it's already
  correct and needs no changes here.
- None of these tables have any seed data — `ingredients` is empty in the
  live project.

### What's missing (the actual gap this spec closes)

1. No bilingual name/subtitle/icon columns on `ingredients` — the current
   mock model (`hooks/useInventory.tsx`) has `nameVi`/`nameEn`/
   `subtitleVi`/`subtitleEn`/`icon`, none of which the real table has.
2. No admin UI anywhere to create an ingredient, edit one, or define a
   menu item's/extra's recipe (`menu_item_ingredients`/
   `modifier_ingredients` have zero rows and zero UI to add any).
3. No Realtime — the mock hook persists to `localStorage` per-browser,
   invisible to any other open session.
4. Extras (shipped last session, `docs/superpowers/plans/2026-07-06-menu-item-extras.md`)
   have no edit UI at all today — only create. Giving an extra its own
   recipe means building that edit affordance first.

## Scope

One implementation plan, not several — every piece below is a dependency
of the next (schema → query layer → hook → UI), not an independent
subsystem. Tasks are still separable and independently testable/
committable within that one plan.

**In scope:**
- Bilingual ingredient schema + an atomic stock-adjustment RPC + Realtime
  publication (migration).
- `lib/supabase/inventory-data.ts` query layer (ingredients, logs,
  recipes for both menu items and modifiers).
- `hooks/useInventory.tsx` rewritten to fetch from Supabase + subscribe to
  Realtime, replacing the `localStorage` model entirely.
- Admin UI: "+ Add Ingredient" on the Inventory page; a new "Recipe"
  section in the menu item Add/Edit form; a new edit affordance on each
  Extra (name/price + its own recipe).
- Dashboard's low-stock widget updated to the new async hook shape.

**Out of scope (explicitly deferred):**
- Real order placement / the deduction trigger actually firing — that's
  sub-project #3 ("Orders"). This spec only makes sure the trigger's
  *inputs* (the recipe tables) can be populated by an admin; it doesn't
  touch order flow.
- Tables/Staff accounts real-time (sub-projects #2 and #4).

## Architecture

### 1. Schema — `supabase/migrations/0010_inventory_i18n_and_stock_fn.sql`

- New enum `public.ingredient_icon` — `'coffee' | 'droplet' | 'wheat' |
  'candy'` (matches the 4 lucide icons already used in
  `inventory-management.tsx`/`dashboard-view.tsx`).
- `ingredients` gains `name_vi text not null`, `name_en text not null`,
  `subtitle_vi text not null default ''`, `subtitle_en text not null
  default ''`, `icon ingredient_icon not null default 'coffee'`. The old
  `name` column is dropped — the table is empty on the live project, so
  no backfill/migration-of-existing-rows step is needed. (Implementation
  step must confirm the table is still empty via `execute_sql` before
  running the `drop column`, the same "verify before you act" pattern
  used for the admin-bootstrap trigger disable last session.)
- New function `public.adjust_ingredient_stock(p_ingredient_id uuid,
  p_change numeric, p_reason inventory_log_reason) returns
  public.ingredients` — `security invoker` (runs under the calling
  session's own role, so the existing `ingredients_admin_all`/
  `inventory_logs_admin_all` RLS policies still gate who can call it; this
  function does not escalate privilege, it only makes the
  read-clamp-write-log sequence atomic in one round trip instead of the
  old mock's client-side clamp, which was safe only because there was
  never more than one browser tab involved). Behavior: locks the target
  row (`for update`), clamps the requested change so stock can't go
  negative (`greatest(p_change, -current_stock)`), applies it, inserts the
  matching `inventory_logs` row (`created_by = auth.uid()`), returns the
  updated `ingredients` row. Raises if the id doesn't exist.
  `grant execute on function ... to authenticated;` so it's callable via
  `supabase.rpc(...)`.
- `alter publication supabase_realtime add table public.ingredients,
  public.inventory_logs;` — required for the Realtime subscriptions in
  Section 3 to receive anything at all. Implementation step must check
  via `execute_sql` (`select * from pg_publication_tables where pubname =
  'supabase_realtime'`) that neither table is already a member before
  running this (adding an already-member table errors).

### 2. Seed — `supabase/migrations/0011_seed_inventory_data.sql`

Inserts the same 4 ingredients currently hardcoded in
`hooks/useInventory.tsx`'s `INITIAL_INGREDIENTS` (Robusta beans/condensed
milk/creamer powder/white sugar — same VI/EN names, subtitles, units,
thresholds), so Inventory/Dashboard show identical content before and
after this migration lands. Stock starts at each ingredient's current
mock stock value via one `adjust_ingredient_stock` call per row (reason
`'adjustment'`) right after insert, rather than an `insert ... values
(..., stock_quantity)` — keeps the invariant "every nonzero stock value
has a corresponding log entry" true from row zero, consistent with how
the RPC will be the only path to a stock change from here on.

### 3. Query layer — new `lib/supabase/inventory-data.ts`

Same DI convention as `lib/supabase/menu-data.ts` (every function takes
`supabase: SupabaseClient` first), same fake-client unit-testing style as
`lib/supabase/menu-data.test.ts`.

```ts
export type IngredientIcon = "coffee" | "droplet" | "wheat" | "candy"

export type Ingredient = {
  id: string
  nameVi: string
  nameEn: string
  subtitleVi: string
  subtitleEn: string
  unit: string
  stock: number
  threshold: number
  icon: IngredientIcon
}

export type IngredientInput = {
  nameVi: string
  nameEn: string
  subtitleVi: string
  subtitleEn: string
  unit: string
  threshold: number
  icon: IngredientIcon
}

export type InventoryLogReason = "restock" | "adjustment" | "waste" | "order_deduction"

export type InventoryLog = {
  id: string
  ingredientId: string
  ingredientNameVi: string
  ingredientNameEn: string
  change: number
  reason: InventoryLogReason
  timestamp: number // Date.parse(created_at)
}

export type RecipeEntry = { ingredientId: string; quantityUsed: number }

export async function getIngredients(supabase): Promise<Ingredient[]>
export async function createIngredient(supabase, input: IngredientInput): Promise<Ingredient>
export async function updateIngredient(supabase, id: string, input: IngredientInput): Promise<Ingredient>
export async function adjustStock(supabase, id: string, change: number, reason: InventoryLogReason): Promise<Ingredient>
export async function getInventoryLogs(supabase): Promise<InventoryLog[]>
export async function getMenuItemIngredients(supabase, menuItemId: string): Promise<RecipeEntry[]>
export async function setMenuItemIngredients(supabase, menuItemId: string, entries: RecipeEntry[]): Promise<void>
export async function getModifierIngredients(supabase, modifierId: string): Promise<RecipeEntry[]>
export async function setModifierIngredients(supabase, modifierId: string, entries: RecipeEntry[]): Promise<void>
```

- `createIngredient`/`updateIngredient` never touch `stock_quantity` — a
  new ingredient always starts at 0 stock (the column's own DB default);
  the only way stock ever changes is through `adjustStock` (which always
  produces a log row). This preserves the existing convention (every
  stock change is logged) instead of creating a silent, unlogged initial
  value.
- `adjustStock` calls the RPC: `supabase.rpc("adjust_ingredient_stock", {
  p_ingredient_id: id, p_change: change, p_reason: reason }).single()`
  and maps the returned row back to `Ingredient`.
- `getInventoryLogs` selects `inventory_logs` joined to
  `ingredients(name_vi, name_en)`, ordered by `created_at` descending,
  capped at 200 rows (matches "recent history," not an unbounded audit
  export — no pagination UI exists for the Logs tab today, so an
  unbounded query would be the wrong default).
- `setMenuItemIngredients`/`setModifierIngredients` follow the exact
  delete-then-bulk-insert pattern `setItemModifierGroups` already uses
  (delete all rows for that id, no-op insert if `entries` is empty,
  otherwise bulk insert).

**`lib/supabase/menu-data.ts` also gains one function**, needed for the
Extras edit affordance (Section 5):

```ts
export async function updateModifierGroup(
  supabase: SupabaseClient,
  groupId: string,
  input: ModifierGroupInput // { nameVi, nameEn, priceDelta } — already defined
): Promise<MenuModifierGroup>
```
Updates `modifier_groups.{name_vi,name_en}` where `id = groupId`, then
`modifiers.{name_vi,name_en,price_delta}` where `modifier_group_id =
groupId` (safe as a single-row update — every extra's group has exactly
one modifier, enforced by `createModifierGroup`'s own insert shape, never
a bulk operation). Returns the refreshed group in `MenuModifierGroup`
shape, same as `createModifierGroup`.

### 4. `hooks/useInventory.tsx` — rewritten

Replaces the `useState` + `localStorage` hydrate-then-persist pattern
entirely (no longer needed — Supabase is now the persistence layer, and a
locale switch remounting the provider just re-fetches instead of losing
state, which is what makes last session's `localStorage` patch
unnecessary going forward).

- On mount: `getIngredients()` + `getInventoryLogs()` via a browser
  Supabase client (`createClient()` from `lib/supabase/client.ts`,
  memoized once). Exposes `isLoading`/`error` alongside the existing
  `ingredients`/`logs`.
- Subscribes to one Realtime channel covering both tables:
  ```ts
  supabase
    .channel("inventory-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "ingredients" }, handleIngredientEvent)
    .on("postgres_changes", { event: "*", schema: "public", table: "inventory_logs" }, handleLogEvent)
    .subscribe()
  ```
  `handleIngredientEvent` upserts/removes the affected row in local state
  by `id` (covers `INSERT`/`UPDATE`/`DELETE`); `handleLogEvent` prepends a
  new row on `INSERT` (logs are never updated/deleted). Unsubscribes
  (`supabase.removeChannel`) on unmount.
- If the channel's `subscribe()` callback reports a non-`"SUBSCRIBED"`
  status (e.g. Realtime unreachable), log a console warning and continue
  — the initial fetch still renders correct data, it just won't receive
  live pushes from other sessions until reconnected. Not a hard failure.
- Mutation functions become async and call the query layer directly:
  `restock`, `adjustStock`, `setOutOfStock` (unchanged signatures/
  behavior from the caller's perspective) plus new `addIngredient`,
  `updateIngredientDetails`. None of them manually update local state
  after a successful call — the Realtime event (which also fires for the
  caller's own change) is what updates the UI, keeping "every session
  sees the same one true update path" instead of a separate optimistic
  code path that could drift from what Realtime later delivers.

### 5. Admin UI

**Inventory page (`components/admin/inventory-management.tsx`)** — adds a
"+ Add Ingredient" button (next to the existing tab bar) opening a new
`components/admin/ingredient-form.tsx` modal: `nameVi`/`nameEn`/
`subtitleVi`/`subtitleEn`/`unit`/`threshold`/an icon picker (4 buttons,
one per `IngredientIcon`, same visual pattern as the size/modifier picker
buttons elsewhere). Same modal component handles both Add and Edit
(`initialIngredient` optional prop, mirrors `menu-item-form.tsx`'s
`initialItem` pattern) — editing an ingredient's row gets a new pencil
icon next to its existing "Adjust Stock" button. Table/Logs tabs otherwise
unchanged, just reading the now-async `ingredients`/`logs` with a loading
skeleton row while `isLoading`.

**New shared component `components/admin/recipe-checklist.tsx`** —
presentational, used by both the menu item Recipe section and the Extra
edit panel below:
```ts
function RecipeChecklist({
  ingredients,          // Ingredient[]
  selected,              // Record<ingredientId, quantityUsed>
  onChange,              // (next: Record<ingredientId, quantityUsed>) => void
  locale,
}: { ... })
```
Renders one row per ingredient: a checkbox: checking it adds the
ingredient to `selected` with an initial `quantityUsed` of `0` and reveals
a numeric input (unit label from `ingredient.unit`) next to it;
unchecking removes its key from `selected`. Exactly the checkbox-then-
reveal-input pattern already established by the Extras checklist, applied
to a quantity field instead of a boolean.

**Menu item form (`components/admin/menu-item-form.tsx`)** — new "Recipe"
section directly below the existing "Extras" section:
- Mount effect fetches `getIngredients()` (new state, same pattern as the
  existing `extraGroups` fetch).
- If editing (`initialItem` present), a second mount effect calls
  `getMenuItemIngredients(supabase, initialItem.id)` and seeds
  `selectedRecipe` from the result — recipe data is fetched by the form
  itself, not folded into `MenuItem`/`getMenuItemById`, keeping menu data
  and inventory data as separate query modules per the existing
  `menu-data.ts`/(new) `inventory-data.ts` split.
- Renders `<RecipeChecklist ingredients={ingredients} selected={selectedRecipe} onChange={setSelectedRecipe} locale={locale} />`.
- `onSave`'s signature grows one more parameter:
  `(input: MenuItemInput, extraGroupIds: string[], recipeEntries: RecipeEntry[]) => void`.
  Validation: a checked ingredient with an empty/zero/non-numeric quantity
  blocks save with an inline error (mirrors the existing
  `amountRequiredError` pattern in `stock-adjust-form.tsx`), same as how
  size/price fields are already validated in this form.

**`components/admin/menu-management.tsx`**'s `saveItem` gains the third
parameter and, after `setItemModifierGroups`, also calls
`setMenuItemIngredients(supabase, saved.id, recipeEntries)` before
refetching the item.

**Extras — new edit affordance** (doesn't exist today, only create): each
row in the Extras checklist gets a small pencil icon. Clicking it expands
an inline panel (not a separate modal — stays contextually next to the
extra it's editing, consistent with how Tables' rename works inline
rather than in a modal) with: `nameVi`/`nameEn`/price inputs (pre-filled),
and a `<RecipeChecklist>` for that one extra's own ingredient usage,
seeded via `getModifierIngredients(supabase, extra.options[0].id)` when
the panel opens. Saving calls `updateModifierGroup` then
`setModifierIngredients(supabase, extra.options[0].id, entries)`, then
refetches the extras list (`getModifierGroups`) so the checklist and any
other open item's form reflect the rename/price change immediately.

### 6. Dashboard (`components/admin/dashboard-view.tsx`)

No behavioral change — still reads `ingredients` from `useInventory()`
and filters `stock < threshold` for the low-stock widget, still calls
`restock(id)`. Only change: render a lightweight loading state (e.g. skip
the low-stock table body, show nothing extra) while `isLoading`, since the
hook is now genuinely async instead of synchronously available from
`useState`'s initial value.

## Data Flow

1. Admin A opens `/admin/inventory`. `InventoryProvider` fetches
   ingredients+logs, subscribes to Realtime.
2. Admin A clicks "Adjust Stock" → `adjustStock(id, +5, "restock")` →
   query layer calls the `adjust_ingredient_stock` RPC → DB updates the
   row + inserts a log row (single atomic transaction).
3. Postgres's replication stream emits both changes; Supabase Realtime
   delivers `UPDATE ingredients` and `INSERT inventory_logs` events to
   **every subscribed client**, including Admin A's own tab and Admin B's
   tab open on `/admin/dashboard` elsewhere.
4. Both tabs' `InventoryProvider` merges the event into local state — the
   updated stock number and new log row appear on Admin B's screen
   without a refresh, and Admin A's own UI updates the same way (no
   separate optimistic-update code path to keep in sync with reality).

## Error Handling

- RPC/query failures (network, RLS denial, etc.) surface as an inline
  error banner in whichever form/page triggered them (`t("saveError")` /
  `t("adjustStockError")` style, matching the existing pattern in
  `menu-management.tsx`/`stock-adjust-form.tsx`) — never a silent no-op.
- Realtime subscribe failure degrades to "fetched-once, not live" rather
  than breaking the page (see Section 4 above).
- `adjust_ingredient_stock` raising on a missing id (shouldn't happen
  from the UI, but guards against a stale client-side id after another
  admin deletes an ingredient mid-session) surfaces the same way as any
  other RPC error — an inline banner, not a crash.

## Testing

- `lib/supabase/inventory-data.test.ts` (new, mirrors
  `menu-data.test.ts`'s fake-Supabase-client style): mapping correctness
  for `getIngredients`/`getInventoryLogs`, that `adjustStock` calls
  `.rpc("adjust_ingredient_stock", {...})` with the right argument names,
  and delete-then-insert behavior (including the empty-array no-op case)
  for both `setMenuItemIngredients` and `setModifierIngredients`.
- `lib/supabase/menu-data.test.ts` gains a case for `updateModifierGroup`.
- Realtime subscription behavior itself is not unit-tested (no practical
  way to fake a Postgres replication stream in Vitest) — verified live
  via Playwright instead, same convention as every other feature in this
  project: open two browser contexts (two admin sessions), adjust stock in
  one, confirm the other's Inventory table and Dashboard widget update
  without a manual reload.
- Live verification checklist for the plan's final task: add an
  ingredient, edit it, adjust its stock, confirm the Logs tab shows the
  right reason/sign; attach a recipe to a menu item and confirm
  `menu_item_ingredients` has the right rows (via `execute_sql` or the
  Supabase dashboard); edit an existing extra's name/price and recipe,
  confirm it reflects immediately in another open tab; confirm Dashboard's
  low-stock widget and restock button still work end-to-end.

## Self-Review Notes

- Checked for placeholders/TBDs — none found.
- Checked internal consistency — the RPC's `security invoker` choice is
  referenced consistently in both the Schema and Data Flow sections; the
  "no direct stock writes outside `adjustStock`" invariant is stated once
  in Section 3 and honored by the seed migration's approach (Section 2)
  rather than contradicted by it.
- Checked scope — confirmed this stays one plan (Section "Scope" above)
  rather than needing decomposition; every piece is a hard dependency of
  the next, not an independent subsystem.
