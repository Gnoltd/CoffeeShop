# Menu Item Extras (Admin-Configurable Modifiers) — Design

**Date:** 2026-07-06
**Status:** Proposed — pending user review before writing an implementation plan.

## Overview

Admin-configurable optional "extras" for menu items — e.g. "Extra Shot
+10.000đ" — that only apply to the specific drinks an admin enables them
on. A customer sees the price and picks whichever extras they want on
the Product Detail Page; extras are never forced, and only some items
offer them.

The underlying schema (`modifier_groups`, `modifiers`,
`menu_item_modifier_groups`, all from migration `0003_menu`, RLS already
restricting writes to manager/admin) and the entire customer-facing
selection UI (`components/customer/product-detail.tsx`) already exist
and work. The actual gap is narrow: there is no admin UI to create or
edit modifier groups, or to attach/detach them from a specific item —
`components/admin/menu-item-form.tsx` has no modifier-related code at
all, and `lib/supabase/menu-data.ts` has create/update functions only for
`menu_items` itself.

A real, related bug was also found while reading `product-detail.tsx`:
an optional (non-`required`) modifier group with a single option —
exactly the shape "Extra Shot" takes — can be selected but never
deselected, since the click handler always sets the selection and never
clears it. This spec fixes that as part of making extras actually usable.

## Key data-model decision: one modifier_group per extra

Two requirements have to hold at once: extras are a **shared library**
(define "Extra Shot" once, its name/price is consistent everywhere), and
admin picks a **per-item subset** (only some drinks offer it). Since
`menu_item_modifier_groups` links items to whole *groups*, not individual
*modifiers*, a single shared group containing every extra as its options
would attach all-or-nothing per item — it cannot represent "this drink
offers Extra Shot and Oat Milk, that drink offers only Extra Shot."

The fix: **each extra is its own `modifier_group`** (`is_required =
false`, `max_selections = 1`) containing **exactly one `modifier`** (the
extra itself: name + `price_delta`). Reuse across items comes from
multiple items linking to the *same* group row via
`menu_item_modifier_groups`; per-item subset selection comes from which
groups each item links to. No schema change or migration is needed —
this is purely a usage convention over the existing tables.

This is a different shape from the seeded "Milk Options" example (one
group, two alternative options, single-select) — that multi-option
style remains a separate, pre-existing concept, untouched by this spec.
The new admin "Extras" UI only lists/creates single-option groups.

## Scope boundaries (explicitly out of this spec)

- **Editing an existing extra's name or price** after creation. Once
  created, an extra's definition is fixed for this pass — a mistake
  means creating a new one, not editing the old one. A real gap, not
  hidden: deferred to a later pass if it's actually needed.
- **Deleting an extra from the shared library.** Detaching it from all
  items (via the per-item checklist) is possible; removing the
  `modifier_group`/`modifier` rows themselves is not built here.
- **Multi-option groups** (like "Milk Options") stay exactly as they are
  today — no new UI manages them, and this spec's toggle-off fix in
  `product-detail.tsx` only changes behavior for non-`required` groups.
  The seeded "Milk Options" group is `is_required = true` (confirmed in
  `migrations/0009_seed_menu_data.sql`), so it's untouched by this
  change — it keeps today's always-exactly-one-selected behavior.
- **Sizes** (`menu_item_sizes`) are a separate, still-not-admin-editable
  gap (seeded via migration only) — not addressed here, same as before
  this spec.

---

## Part 1: Query layer (`lib/supabase/menu-data.ts`)

Three new exported functions, alongside the existing `MenuModifierGroup`/
`MenuModifierOption` types (unchanged shape — a single-option "extra" is
just a `MenuModifierGroup` whose `options` array happens to have length 1):

- `getModifierGroups(supabase): Promise<MenuModifierGroup[]>` — fetches
  every `modifier_groups` row with its `modifiers`, for the admin
  picker. The admin UI filters this client-side to `options.length ===
  1` (an "extra") before rendering the checklist, so multi-option groups
  never appear there.
- `createModifierGroup(supabase, input: { nameVi: string; nameEn:
  string; priceDelta: number }): Promise<MenuModifierGroup>` — inserts a
  new `modifier_groups` row (`is_required: false`, `max_selections: 1`)
  then a single `modifiers` row referencing it, returning the combined
  shape. Writes to the shared library **immediately** when the admin
  confirms the inline "+ Add New Extra" mini-form — not deferred until
  the item form's own Save. If the admin then cancels the item form
  without saving, the newly-created extra still exists in the shared
  library (just unattached to anything) — expected, not a bug, since
  it's a genuinely separate, reusable resource.
- `setItemModifierGroups(supabase, itemId: string, groupIds: string[]):
  Promise<void>` — replaces the item's full set of attached groups:
  deletes every existing `menu_item_modifier_groups` row for `itemId`,
  then inserts one row per id in `groupIds`. Simple wholesale replace
  rather than diffing old vs. new, matching the "Save" button's
  all-fields-at-once semantics for the rest of the item form.

## Part 2: Admin UI (`menu-item-form.tsx`, `menu-management.tsx`)

`MenuItemForm` gains:
- On mount, calls `getModifierGroups` and filters to single-option
  groups ("extras"). Initializes selected state from
  `initialItem?.modifierGroups.map(g => g.id) ?? []` when editing, `[]`
  when adding.
- A new "Extras" section (same visual style as the existing toggle/list
  sections): one row per known extra — checkbox, bilingual name, price
  (e.g. "+10.000đ") — toggling attaches/detaches it for *this* item
  (local state only until the whole form is saved).
- An inline "+ Add New Extra" control below the checklist: reveals name
  VI / name EN / price inputs and a confirm button. Confirming calls
  `createModifierGroup` right away (see Part 1), adds the result to the
  checklist, and auto-checks it for the current item (the admin was
  visibly creating it for this item).
- `onSave`'s signature grows from `(input: MenuItemInput) => void` to
  `(input: MenuItemInput, extraGroupIds: string[]) => void`.

`MenuManagement`'s `saveItem` calls `setItemModifierGroups(supabase,
item.id, extraGroupIds)` immediately after `createMenuItem`/
`updateMenuItem` resolves (needed for a brand-new item, which has no id
until that insert completes).

New translation keys in both `messages/vi.json` and `messages/en.json`,
under the existing `AdminMenu` namespace: a section label ("Extras" /
"Tùy Chọn Thêm"), the inline add-form's field labels/placeholders, and
its confirm button text.

## Part 3: Customer-facing toggle-off fix (`product-detail.tsx`)

The modifier-group click handler currently always sets the selection:

```tsx
onClick={() => setSelectedModifiers((prev) => ({ ...prev, [group.id]: option.id }))}
```

Changes to: if the group is not `required` and the tapped option is
already selected for that group, clear the group's entry (real
toggle-off); otherwise set it as today. `required` groups (Size) are
unaffected — they keep exactly one selection at all times, matching
today's behavior and the `defaults` initialization that already only
runs for required groups.

This is what actually makes "pick any number of extras independently"
work for a customer: each extra is its own single-option optional group
rendered side by side, and each is now genuinely toggleable rather than
one-way.

---

## Testing

- No new pure-logic unit tests planned beyond what already exists for
  `menu-data.ts` (`getCategories`/`getMenuItems`/`createMenuItem` are
  already covered in `lib/supabase/menu-data.test.ts` with a DI'd fake
  Supabase client) — the three new functions follow the same
  DI'd-`SupabaseClient` convention and get the same style of test
  coverage (fake client, assert on the exact insert/delete/select calls
  made) as part of implementation.
- Manual verification on the live Vercel deployment, logged in as
  admin: create a new extra while editing an item, confirm it appears
  checked for that item and unchecked for a different item; confirm the
  same extra can be attached to a second item without re-entering its
  name/price; confirm a customer visiting that item's Product Detail
  Page can select and then deselect the extra, and that the cart/price
  reflects it correctly when selected.
