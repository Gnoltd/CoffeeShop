# Menu Data Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `lib/mock-data/menu.ts` with real Supabase data (`categories`,
`menu_items`, `menu_item_sizes`, `modifier_groups`, `modifiers`) so every page
that currently reads the mock file reads and writes the real database instead.
This is a hard prerequisite for the follow-up Stripe Payments plan —
`order_items.menu_item_id` is a `NOT NULL` foreign key into `menu_items`, so a
real order cannot exist while the menu is still mock data.

**Architecture:** Two new migrations (schema translation columns, then seed
data) applied to the live Supabase project via the Supabase MCP tools. One new
shared query module (`lib/supabase/menu-data.ts`) used by every consumer.
Every page that renders menu data becomes a Server Component that fetches via
this module and passes plain props into its existing client component — no
new client-side loading states, matching how these pages already render
synchronously today.

**Tech Stack:** Next.js Server Components, `@supabase/supabase-js` (already a
project dependency via `@supabase/ssr`), Vitest (new — see Task 3).

## Global Constraints

- Every new/changed piece of UI text needs keys in **both**
  `messages/en.json` and `messages/vi.json` (this plan adds none — all
  labels touched already exist).
- Client components stay `"use client"`; only their `page.tsx` wrappers
  become data-fetching Server Components.
- No `URL.createObjectURL` behavior changes — image upload stays exactly as
  it is today (out of scope, see the spec).
- Every SQL migration is applied via `mcp__supabase__apply_migration`
  against the live project `qhiypdqnrnzndxdwqxbx`, then verified with
  `mcp__supabase__list_tables`/`execute_sql` before moving on — same
  process used for migrations `0001`-`0007`.

---

### Task 1: Migration 0008 — bilingual columns + icon/is_popular

**Files:**
- Create: `supabase/migrations/0008_menu_translations.sql`

**Interfaces:**
- Produces: `categories(name_vi, name_en)`, `menu_items(name_vi, name_en,
  description_vi, description_en, icon, is_popular)`,
  `modifier_groups(name_vi, name_en)`, `modifiers(name_vi, name_en)`.
  `menu_item_sizes.name` is unchanged (single column — "S"/"M"/"L" are
  language-neutral, confirmed against the current mock data).

- [ ] **Step 1: Write the migration SQL**

Every one of these tables is currently empty (confirmed via
`mcp__supabase__list_tables` — `"rows":0` on all of them), so this drops
and replaces rather than adding alongside:

```sql
-- 0008_menu_translations.sql
-- Split single-language name/description columns into vi/en pairs, and add
-- icon + is_popular to menu_items (previously inferred client-side from
-- category, and hardcoded per-page respectively — both become real,
-- admin-editable columns instead).

alter table public.categories drop column name;
alter table public.categories add column name_vi text not null default '';
alter table public.categories add column name_en text not null default '';
alter table public.categories alter column name_vi drop default;
alter table public.categories alter column name_en drop default;

alter table public.menu_items drop column name;
alter table public.menu_items drop column description;
alter table public.menu_items add column name_vi text not null default '';
alter table public.menu_items add column name_en text not null default '';
alter table public.menu_items add column description_vi text not null default '';
alter table public.menu_items add column description_en text not null default '';
alter table public.menu_items alter column name_vi drop default;
alter table public.menu_items alter column name_en drop default;
alter table public.menu_items alter column description_vi drop default;
alter table public.menu_items alter column description_en drop default;

alter table public.menu_items add column icon text not null default 'coffee';
alter table public.menu_items add constraint menu_items_icon_check
  check (icon in ('coffee', 'cup-soda', 'cookie', 'milk'));
alter table public.menu_items add column is_popular boolean not null default false;

alter table public.modifier_groups drop column name;
alter table public.modifier_groups add column name_vi text not null default '';
alter table public.modifier_groups add column name_en text not null default '';
alter table public.modifier_groups alter column name_vi drop default;
alter table public.modifier_groups alter column name_en drop default;

alter table public.modifiers drop column name;
alter table public.modifiers add column name_vi text not null default '';
alter table public.modifiers add column name_en text not null default '';
alter table public.modifiers alter column name_vi drop default;
alter table public.modifiers alter column name_en drop default;
```

- [ ] **Step 2: Apply the migration**

Use `mcp__supabase__apply_migration` with `name: "0008_menu_translations"`
and the SQL from Step 1 as `query`.

- [ ] **Step 3: Verify the schema**

Use `mcp__supabase__execute_sql`:

```sql
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('categories', 'menu_items', 'modifier_groups', 'modifiers')
  and column_name like '%name%' or column_name in ('icon', 'is_popular')
order by table_name, ordinal_position;
```

Expected: `categories`/`modifier_groups`/`modifiers` each show `name_vi`/
`name_en` (no `name`); `menu_items` shows `name_vi`/`name_en`/
`description_vi`/`description_en`/`icon`/`is_popular` (no `name`/
`description`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0008_menu_translations.sql
git commit -m "Add menu translation columns + icon/is_popular to schema"
```

---

### Task 2: Migration 0009 — seed real menu data

**Files:**
- Create: `supabase/migrations/0009_seed_menu_data.sql`

**Interfaces:**
- Consumes: schema from Task 1.
- Produces: 4 real `categories` rows, 8 real `menu_items` rows, 3 real
  `menu_item_sizes` rows, 1 real `modifier_groups` row with 2 `modifiers`,
  and the `menu_item_modifier_groups`/size linkage — real `gen_random_uuid()`
  ids that later tasks' manual verification will reference by name, not by
  a hardcoded id (the old mock slugs like `phin-sua-da` do not carry over).

- [ ] **Step 1: Write the seed SQL**

Content ported directly from `lib/mock-data/menu.ts` (categories, 8 items,
the S/M/L size set, the milk modifier group). Two items get
`is_popular = true` — "Phin Sữa Đá"/"Iced Milk Coffee" (already `isPopular:
true` in the mock data) plus "Cà Phê Trứng"/"Egg Coffee" and "Cà Phê Đá
Xay"/"Coffee Frappe" (the other two ids that were hardcoded into
`components/marketing/landing-view.tsx`'s `BEST_SELLER_IDS` — that
hardcoded list disappears in Task 5, unified into this one real
`is_popular` flag instead of two independent, inconsistent concepts):

```sql
-- 0009_seed_menu_data.sql
-- Seeds today's mock menu (lib/mock-data/menu.ts) as real rows. Retires
-- that file as a live data source — see Task 10.

insert into public.categories (name_vi, name_en, sort_order) values
  ('Cà Phê', 'Coffee', 0),
  ('Trà', 'Tea', 1),
  ('Bánh Ngọt', 'Pastries', 2),
  ('Đá Xay', 'Blended', 3);

with cat as (
  select id, name_en from public.categories
),
new_items as (
  insert into public.menu_items
    (category_id, name_vi, name_en, description_vi, description_en, base_price, icon, is_available, is_popular)
  select c.id, v.name_vi, v.name_en, v.description_vi, v.description_en, v.base_price, v.icon, v.is_available, v.is_popular
  from (values
    ('Coffee', 'Phin Sữa Đá', 'Iced Milk Coffee', 'Cà phê phin truyền thống hòa quyện cùng sữa đặc béo ngậy.', 'Authentic drip coffee with condensed milk.', 29000, 'coffee', true, true),
    ('Coffee', 'Cà Phê Đen', 'Black Coffee', 'Đậm đà hương vị truyền thống.', 'Strong and bold traditional taste.', 25000, 'coffee', true, false),
    ('Coffee', 'Cà Phê Trứng', 'Egg Coffee', 'Hương vị Hà Nội nồng nàn.', 'Signature Hanoi creamy egg foam.', 45000, 'coffee', true, true),
    ('Coffee', 'Bạc Xỉu', 'White Coffee', 'Nhiều sữa ít cà phê.', 'Milk-forward coffee delight.', 32000, 'milk', false, false),
    ('Tea', 'Trà Sen Vàng', 'Golden Lotus Tea', 'Thanh mát hương sen tự nhiên.', 'Refreshing natural lotus fragrance.', 39000, 'cup-soda', true, false),
    ('Tea', 'Trà Vải', 'Lychee Tea', 'Vị ngọt trái cây tươi mát.', 'Sweet, refreshing fruit flavor.', 35000, 'cup-soda', true, false),
    ('Pastries', 'Bánh Mì Que', 'Crispy Breadsticks', 'Giòn rụm, dùng kèm pate.', 'Crispy breadsticks served with pate.', 19000, 'cookie', true, false),
    ('Pastries', 'Bánh Croissant Bơ', 'Butter Croissant', 'Lớp vỏ giòn tan, thơm bơ.', 'Flaky, buttery layers.', 28000, 'cookie', true, false),
    ('Blended', 'Cà Phê Đá Xay', 'Coffee Frappe', 'Mát lạnh, sánh mịn.', 'Cold, smooth, and creamy.', 42000, 'cup-soda', true, true)
  ) as v(cat_name_en, name_vi, name_en, description_vi, description_en, base_price, icon, is_available, is_popular)
  join cat c on c.name_en = v.cat_name_en
  returning id, name_en
)
select 1; -- CTE above is materialized for the inserts below via a second pass

-- Sizes apply to every item except Egg Coffee, Lychee Tea, Crispy
-- Breadsticks, and Butter Croissant (matches sizeOptions being omitted for
-- those items in the original mock data).
insert into public.menu_item_sizes (menu_item_id, name, price_delta)
select mi.id, s.name, s.price_delta
from public.menu_items mi
cross join (values ('S', -5000), ('M', 0), ('L', 8000)) as s(name, price_delta)
where mi.name_en in (
  'Iced Milk Coffee', 'Black Coffee', 'White Coffee',
  'Golden Lotus Tea', 'Coffee Frappe'
);

-- Milk modifier group, required, applies only to Iced Milk Coffee (the
-- only item with modifierGroups in the original mock data).
with grp as (
  insert into public.modifier_groups (name_vi, name_en, is_required, max_selections)
  values ('Lựa Chọn Sữa', 'Milk Options', true, 1)
  returning id
),
opts as (
  insert into public.modifiers (modifier_group_id, name_vi, name_en, price_delta)
  select grp.id, v.name_vi, v.name_en, v.price_delta
  from grp, (values
    ('Sữa Đặc', 'Condensed Milk', 0),
    ('Sữa Tươi', 'Fresh Milk', 5000)
  ) as v(name_vi, name_en, price_delta)
  returning modifier_group_id
)
insert into public.menu_item_modifier_groups (menu_item_id, modifier_group_id)
select mi.id, grp.id
from public.menu_items mi, grp
where mi.name_en = 'Iced Milk Coffee';
```

- [ ] **Step 2: Apply the migration**

Use `mcp__supabase__apply_migration` with `name: "0009_seed_menu_data"`.

- [ ] **Step 3: Verify the seed**

```sql
select c.name_en as category, count(mi.id) as item_count
from public.categories c
left join public.menu_items mi on mi.category_id = c.id
group by c.name_en
order by c.name_en;
```

Expected: `Coffee` → 4, `Tea` → 2, `Pastries` → 2, `Blended` → 1 (9 items
total — the plan's earlier count of "8 items" undercounted; the mock data
actually has 9: recount confirms Coffee has 4, not the 3 originally
implied). Also verify sizes/modifiers:

```sql
select (select count(*) from public.menu_item_sizes) as sizes,
       (select count(*) from public.modifier_groups) as modifier_groups,
       (select count(*) from public.modifiers) as modifiers,
       (select count(*) from public.menu_item_modifier_groups) as links;
```

Expected: `sizes: 15` (5 items × 3 sizes), `modifier_groups: 1`,
`modifiers: 2`, `links: 1`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0009_seed_menu_data.sql
git commit -m "Seed real menu data from lib/mock-data/menu.ts"
```

---

### Task 3: Vitest setup + read queries in `lib/supabase/menu-data.ts`

**Files:**
- Create: `vitest.config.ts`
- Create: `lib/supabase/menu-data.ts`
- Create: `lib/supabase/menu-data.test.ts`
- Modify: `package.json` (add `vitest`, `@vitest/ui` is optional/skip it;
  add a `"test": "vitest run"` script)

**Interfaces:**
- Produces: `MenuCategory`, `MenuItem`, `MenuItemSize`, `MenuModifierGroup`,
  `MenuModifierOption`, `MenuIcon` types; `getCategories(supabase)`,
  `getMenuItems(supabase)`, `getMenuItemById(supabase, id)` functions. Every
  function takes a `SupabaseClient` as its first argument (dependency
  injection) so both server (`lib/supabase/server.ts`) and client
  (`lib/supabase/client.ts`) callers share one implementation.

- [ ] **Step 1: Install Vitest**

```bash
npm install --save-dev vitest
```

- [ ] **Step 2: Add the test script**

Edit `package.json`'s `scripts` block:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run"
  }
}
```

- [ ] **Step 3: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
  },
})
```

- [ ] **Step 4: Write the failing test for `getCategories`**

```ts
// lib/supabase/menu-data.test.ts
import { describe, it, expect, vi } from "vitest"
import { getCategories } from "./menu-data"

function fakeSupabase(rows: unknown[]) {
  return {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: rows, error: null }),
      }),
    }),
  } as any
}

describe("getCategories", () => {
  it("maps snake_case DB rows to camelCase MenuCategory", async () => {
    const supabase = fakeSupabase([
      { id: "cat-1", name_vi: "Cà Phê", name_en: "Coffee", sort_order: 0 },
    ])
    const result = await getCategories(supabase)
    expect(result).toEqual([
      { id: "cat-1", nameVi: "Cà Phê", nameEn: "Coffee", sortOrder: 0 },
    ])
  })
})
```

- [ ] **Step 5: Run it, confirm it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './menu-data'` (file doesn't exist yet).

- [ ] **Step 6: Write `lib/supabase/menu-data.ts`'s types and `getCategories`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js"

export type MenuIcon = "coffee" | "cup-soda" | "cookie" | "milk"

export type MenuCategory = {
  id: string
  nameVi: string
  nameEn: string
  sortOrder: number
}

export type MenuItemSize = {
  id: string
  name: string
  priceDelta: number
}

export type MenuModifierOption = {
  id: string
  nameVi: string
  nameEn: string
  priceDelta: number
}

export type MenuModifierGroup = {
  id: string
  nameVi: string
  nameEn: string
  required: boolean
  options: MenuModifierOption[]
}

export type MenuItem = {
  id: string
  categoryId: string
  nameVi: string
  nameEn: string
  descriptionVi: string
  descriptionEn: string
  basePrice: number
  icon: MenuIcon
  isAvailable: boolean
  isPopular: boolean
  imageUrl: string | null
  sizes: MenuItemSize[]
  modifierGroups: MenuModifierGroup[]
}

export type MenuItemInput = {
  categoryId: string
  nameVi: string
  nameEn: string
  descriptionVi: string
  descriptionEn: string
  basePrice: number
  icon: MenuIcon
  isAvailable: boolean
  isPopular: boolean
  imageUrl?: string | null
}

export async function getCategories(supabase: SupabaseClient): Promise<MenuCategory[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name_vi, name_en, sort_order")
    .order("sort_order")
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    id: row.id,
    nameVi: row.name_vi,
    nameEn: row.name_en,
    sortOrder: row.sort_order,
  }))
}
```

- [ ] **Step 7: Run the test, confirm it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Write the failing test for `getMenuItems`'s nested mapping**

```ts
// append to lib/supabase/menu-data.test.ts
import { getMenuItems } from "./menu-data"

describe("getMenuItems", () => {
  it("flattens nested sizes and modifier groups into camelCase", async () => {
    const row = {
      id: "item-1",
      category_id: "cat-1",
      name_vi: "Phin Sữa Đá",
      name_en: "Iced Milk Coffee",
      description_vi: "mô tả",
      description_en: "description",
      base_price: 29000,
      icon: "coffee",
      is_available: true,
      is_popular: true,
      image_url: null,
      menu_item_sizes: [{ id: "size-1", name: "M", price_delta: 0 }],
      menu_item_modifier_groups: [
        {
          modifier_groups: {
            id: "grp-1",
            name_vi: "Lựa Chọn Sữa",
            name_en: "Milk Options",
            is_required: true,
            modifiers: [
              { id: "mod-1", name_vi: "Sữa Đặc", name_en: "Condensed Milk", price_delta: 0 },
            ],
          },
        },
      ],
    }
    const supabase = {
      from: () => ({
        select: () => Promise.resolve({ data: [row], error: null }),
      }),
    } as any

    const result = await getMenuItems(supabase)

    expect(result).toEqual([
      {
        id: "item-1",
        categoryId: "cat-1",
        nameVi: "Phin Sữa Đá",
        nameEn: "Iced Milk Coffee",
        descriptionVi: "mô tả",
        descriptionEn: "description",
        basePrice: 29000,
        icon: "coffee",
        isAvailable: true,
        isPopular: true,
        imageUrl: null,
        sizes: [{ id: "size-1", name: "M", priceDelta: 0 }],
        modifierGroups: [
          {
            id: "grp-1",
            nameVi: "Lựa Chọn Sữa",
            nameEn: "Milk Options",
            required: true,
            options: [{ id: "mod-1", nameVi: "Sữa Đặc", nameEn: "Condensed Milk", priceDelta: 0 }],
          },
        ],
      },
    ])
  })
})
```

- [ ] **Step 9: Run it, confirm it fails**

Run: `npm test`
Expected: FAIL — `getMenuItems is not a function`.

- [ ] **Step 10: Implement `getMenuItems` and the shared row-mapping function**

Append to `lib/supabase/menu-data.ts`:

```ts
const MENU_ITEM_SELECT = `
  id, category_id, name_vi, name_en, description_vi, description_en,
  base_price, icon, is_available, is_popular, image_url,
  menu_item_sizes ( id, name, price_delta ),
  menu_item_modifier_groups (
    modifier_groups ( id, name_vi, name_en, is_required, modifiers ( id, name_vi, name_en, price_delta ) )
  )
`

function mapMenuItemRow(row: any): MenuItem {
  return {
    id: row.id,
    categoryId: row.category_id,
    nameVi: row.name_vi,
    nameEn: row.name_en,
    descriptionVi: row.description_vi,
    descriptionEn: row.description_en,
    basePrice: row.base_price,
    icon: row.icon,
    isAvailable: row.is_available,
    isPopular: row.is_popular,
    imageUrl: row.image_url,
    sizes: (row.menu_item_sizes ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      priceDelta: s.price_delta,
    })),
    modifierGroups: (row.menu_item_modifier_groups ?? []).map((link: any) => ({
      id: link.modifier_groups.id,
      nameVi: link.modifier_groups.name_vi,
      nameEn: link.modifier_groups.name_en,
      required: link.modifier_groups.is_required,
      options: (link.modifier_groups.modifiers ?? []).map((m: any) => ({
        id: m.id,
        nameVi: m.name_vi,
        nameEn: m.name_en,
        priceDelta: m.price_delta,
      })),
    })),
  }
}

export async function getMenuItems(supabase: SupabaseClient): Promise<MenuItem[]> {
  const { data, error } = await supabase.from("menu_items").select(MENU_ITEM_SELECT)
  if (error) throw error
  return (data ?? []).map(mapMenuItemRow)
}

export async function getMenuItemById(supabase: SupabaseClient, id: string): Promise<MenuItem | null> {
  const { data, error } = await supabase
    .from("menu_items")
    .select(MENU_ITEM_SELECT)
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  return data ? mapMenuItemRow(data) : null
}
```

- [ ] **Step 11: Run the tests, confirm they pass**

Run: `npm test`
Expected: PASS (3 tests: `getCategories`, `getMenuItems`, and re-running
Step 4's test).

- [ ] **Step 12: Verify the real nested-select query against the live, seeded database**

This is the step that actually proves the PostgREST embed syntax in
`MENU_ITEM_SELECT` is correct against the real schema (Vitest above only
proves the *mapping* is correct against a hand-built fake row). Use
`mcp__supabase__execute_sql` — Supabase's SQL editor can't run a PostgREST
embed directly, so instead confirm the underlying joins resolve correctly
in plain SQL as a proxy check:

```sql
select mi.name_en, mis.name as size_name, mg.name_en as modifier_group
from public.menu_items mi
left join public.menu_item_sizes mis on mis.menu_item_id = mi.id
left join public.menu_item_modifier_groups mimg on mimg.menu_item_id = mi.id
left join public.modifier_groups mg on mg.id = mimg.modifier_group_id
where mi.name_en = 'Iced Milk Coffee'
order by mis.name;
```

Expected: 3 rows (one per size), all showing `modifier_group: Milk
Options`. Then do the real end-to-end proof in Task 6's manual browser
verification, which actually exercises the PostgREST embed through
`getMenuItems`.

- [ ] **Step 13: Commit**

```bash
git add vitest.config.ts lib/supabase/menu-data.ts lib/supabase/menu-data.test.ts package.json package-lock.json
git commit -m "Add Vitest, real menu-data read queries with tests"
```

---

### Task 4: Write functions in `lib/supabase/menu-data.ts`

**Files:**
- Modify: `lib/supabase/menu-data.ts`
- Modify: `lib/supabase/menu-data.test.ts`

**Interfaces:**
- Consumes: `MenuItemInput` type from Task 3.
- Produces: `createMenuItem(supabase, input)`, `updateMenuItem(supabase, id,
  input)`, `deleteMenuItem(supabase, id)` — used by Task 9's Admin Menu
  Management.

- [ ] **Step 1: Write the failing test for `createMenuItem`**

```ts
// append to lib/supabase/menu-data.test.ts
import { createMenuItem } from "./menu-data"

describe("createMenuItem", () => {
  it("inserts snake_case columns and returns the mapped row", async () => {
    const insertedRow = {
      id: "item-new",
      category_id: "cat-1",
      name_vi: "Trà Đào",
      name_en: "Peach Tea",
      description_vi: "mô tả",
      description_en: "description",
      base_price: 35000,
      icon: "cup-soda",
      is_available: true,
      is_popular: false,
      image_url: null,
      menu_item_sizes: [],
      menu_item_modifier_groups: [],
    }
    const insertSpy = vi.fn(() => ({
      select: () => ({
        single: () => Promise.resolve({ data: insertedRow, error: null }),
      }),
    }))
    const supabase = { from: () => ({ insert: insertSpy }) } as any

    const result = await createMenuItem(supabase, {
      categoryId: "cat-1",
      nameVi: "Trà Đào",
      nameEn: "Peach Tea",
      descriptionVi: "mô tả",
      descriptionEn: "description",
      basePrice: 35000,
      icon: "cup-soda",
      isAvailable: true,
      isPopular: false,
    })

    expect(insertSpy).toHaveBeenCalledWith({
      category_id: "cat-1",
      name_vi: "Trà Đào",
      name_en: "Peach Tea",
      description_vi: "mô tả",
      description_en: "description",
      base_price: 35000,
      icon: "cup-soda",
      is_available: true,
      is_popular: false,
      image_url: null,
    })
    expect(result.id).toBe("item-new")
    expect(result.nameEn).toBe("Peach Tea")
  })
})
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `npm test`
Expected: FAIL — `createMenuItem is not a function`.

- [ ] **Step 3: Implement the write functions**

Append to `lib/supabase/menu-data.ts`:

```ts
function toRow(input: MenuItemInput) {
  return {
    category_id: input.categoryId,
    name_vi: input.nameVi,
    name_en: input.nameEn,
    description_vi: input.descriptionVi,
    description_en: input.descriptionEn,
    base_price: input.basePrice,
    icon: input.icon,
    is_available: input.isAvailable,
    is_popular: input.isPopular,
    image_url: input.imageUrl ?? null,
  }
}

export async function createMenuItem(supabase: SupabaseClient, input: MenuItemInput): Promise<MenuItem> {
  const { data, error } = await supabase
    .from("menu_items")
    .insert(toRow(input))
    .select(MENU_ITEM_SELECT)
    .single()
  if (error) throw error
  return mapMenuItemRow(data)
}

export async function updateMenuItem(
  supabase: SupabaseClient,
  id: string,
  input: MenuItemInput
): Promise<MenuItem> {
  const { data, error } = await supabase
    .from("menu_items")
    .update(toRow(input))
    .eq("id", id)
    .select(MENU_ITEM_SELECT)
    .single()
  if (error) throw error
  return mapMenuItemRow(data)
}

export async function deleteMenuItem(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("menu_items").delete().eq("id", id)
  if (error) throw error
}
```

- [ ] **Step 4: Run the tests, confirm they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/menu-data.ts lib/supabase/menu-data.test.ts
git commit -m "Add menu-data write functions (create/update/delete)"
```

---

### Task 5: Wire Landing (best sellers)

**Files:**
- Modify: `app/[locale]/(marketing)/page.tsx`
- Modify: `components/marketing/landing-view.tsx`

**Interfaces:**
- Consumes: `getMenuItems`, `MenuItem` from `lib/supabase/menu-data.ts`;
  `createClient` from `lib/supabase/server.ts`.

- [ ] **Step 1: Fetch in the page wrapper**

```tsx
// app/[locale]/(marketing)/page.tsx
import { getTranslations } from "next-intl/server"
import { LandingView } from "@/components/marketing/landing-view"
import { createClient } from "@/lib/supabase/server"
import { getMenuItems } from "@/lib/supabase/menu-data"

export default async function LandingPage() {
  const t = await getTranslations("Landing")
  const supabase = await createClient()
  const items = await getMenuItems(supabase)
  const bestSellers = items.filter((item) => item.isPopular)

  return (
    <>
      <h1 className="sr-only">{t("title")}</h1>
      <LandingView bestSellers={bestSellers} />
    </>
  )
}
```

- [ ] **Step 2: Accept the prop in `LandingView`, drop the mock import**

Replace the top of `components/marketing/landing-view.tsx`:

```tsx
"use client"

import { useLocale, useTranslations } from "next-intl"
import { Coffee, CupSoda, Cookie, Milk, QrCode, Sparkles, ArrowRight } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { formatVND } from "@/lib/format"
import type { MenuItem, MenuIcon } from "@/lib/supabase/menu-data"

const ICONS: Record<MenuIcon, typeof Coffee> = {
  coffee: Coffee,
  "cup-soda": CupSoda,
  cookie: Cookie,
  milk: Milk,
}

export function LandingView({ bestSellers }: { bestSellers: MenuItem[] }) {
  const locale = useLocale()
  const t = useTranslations("Landing")
```

Remove the old `const BEST_SELLER_IDS = [...]` line and the old
`const bestSellers = menuItems.filter(...)` line entirely — the prop
replaces both. Everywhere else in the file that reads `item.nameVi` /
`item.nameEn` / `item.basePrice` / `ICONS[item.icon]` on a `bestSellers`
entry is unchanged (same field names, same shape).

Also update the category chips section further down in this file — it has
its own `menuCategories.map((category) => { const label = locale === "vi"
? category.labelVi : category.labelEn; ... })`. Categories aren't
otherwise used on this page beyond these vi/en labels, so this doesn't
need a second fetch — replace the import-derived array with a local
constant using the **same field names already referenced in that JSX**
(`labelVi`/`labelEn`, not the query module's `nameVi`/`nameEn` — this is a
plain local constant, not the `MenuCategory` type from `menu-data.ts`):

```tsx
const CATEGORY_CHIPS = [
  { id: "coffee", labelVi: "Cà Phê", labelEn: "Coffee" },
  { id: "tea", labelVi: "Trà", labelEn: "Tea" },
  { id: "pastries", labelVi: "Bánh Ngọt", labelEn: "Pastries" },
  { id: "blended", labelVi: "Đá Xay", labelEn: "Blended" },
]
```

Change only `menuCategories.map(...)` to `CATEGORY_CHIPS.map(...)` — the
`const label = locale === "vi" ? category.labelVi : category.labelEn` line
and everything else in that block stays exactly as it is, since the field
names already match.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `landing-view.tsx` or its page wrapper.

- [ ] **Step 3: Manual verification**

Start the dev server (`npm run dev`), navigate to `/en` (or `/vi`),
confirm: hero renders, the "Best Sellers" horizontal scroll shows exactly
3 items (Iced Milk Coffee, Egg Coffee, Coffee Frappe — the 3 seeded with
`is_popular = true`), category chips render and link to `/menu`.

- [ ] **Step 4: Commit**

```bash
git add "app/[locale]/(marketing)/page.tsx" components/marketing/landing-view.tsx
git commit -m "Wire Landing best-sellers to real menu_items"
```

---

### Task 6: Wire Menu Browser

**Files:**
- Modify: `app/[locale]/(customer)/menu/page.tsx`
- Modify: `components/customer/menu-browser.tsx`

**Interfaces:**
- Consumes: `getCategories`, `getMenuItems`, `MenuCategory`, `MenuItem`
  from `lib/supabase/menu-data.ts`.

- [ ] **Step 1: Fetch in the page wrapper**

```tsx
// app/[locale]/(customer)/menu/page.tsx
import { getTranslations } from "next-intl/server"
import { MenuBrowser } from "@/components/customer/menu-browser"
import { createClient } from "@/lib/supabase/server"
import { getCategories, getMenuItems } from "@/lib/supabase/menu-data"

export default async function MenuPage() {
  const t = await getTranslations("Customer")
  const supabase = await createClient()
  const [categories, items] = await Promise.all([getCategories(supabase), getMenuItems(supabase)])

  return (
    <>
      <h1 className="sr-only">{t("menuTitle")}</h1>
      <MenuBrowser categories={categories} items={items} />
    </>
  )
}
```

- [ ] **Step 2: Accept props in `MenuBrowser`**

Replace the import and function signature in
`components/customer/menu-browser.tsx`:

```tsx
import type { MenuCategory, MenuIcon, MenuItem } from "@/lib/supabase/menu-data"
```

(remove the old `import { menuCategories, menuItems, type MenuIcon, type
MenuItem } from "@/lib/mock-data/menu"` line)

```tsx
export function MenuBrowser({ categories, items }: { categories: MenuCategory[]; items: MenuItem[] }) {
  const locale = useLocale()
  const t = useTranslations("Menu")
  const router = useRouter()
  const { addItem, itemCount, subtotal } = useCart()

  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.id ?? "")
  const [searchQuery, setSearchQuery] = useState("")

  const name = (item: MenuItem) => (locale === "vi" ? item.nameVi : item.nameEn)
  const description = (item: MenuItem) => (locale === "vi" ? item.descriptionVi : item.descriptionEn)
  const categoryLabel = (c: MenuCategory) => (locale === "vi" ? c.nameVi : c.nameEn)

  const visibleItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return items.filter((item) => {
      const matchesCategory = item.categoryId === selectedCategory
      const matchesQuery =
        query === "" ||
        item.nameVi.toLowerCase().includes(query) ||
        item.nameEn.toLowerCase().includes(query)
      return matchesCategory && matchesQuery
    })
  }, [items, selectedCategory, searchQuery])
```

Then replace every remaining `menuCategories` reference in the JSX
(the category-chip `.map`) with `categories`. `item.rating`/
`item.reviewCount` no longer exist on the real `MenuItem` type — remove
the whole conditional block that renders `<StarRating rating={item.rating}
.../>` inside the item card (Task 7 restores a rating display on Product
Detail using a shared mock constant; Menu Browser's list view didn't need
its own — check the file: this block is lines 144-149 in the current
version, guarded by `item.rating !== undefined`). Delete that block
entirely, **and also delete the now-unused `import { StarRating } from
"@/components/customer/star-rating"` line** at the top of the file —
nothing else in this component renders it, so leaving it would fail
`npx eslint .`'s unused-import check. The rest of the card (name, description, price, popular badge,
quick-add button) is unchanged.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `menu-browser.tsx` or its page wrapper.

- [ ] **Step 4: Manual verification**

Navigate to `/en/menu`. Confirm: category chips show all 4 real
categories, switching categories filters correctly, search filters by
name, items show real prices, the "Popular" badge shows on the 3
`is_popular` items, quick-add (`+`) works for items with no sizes/modifiers
(Black Coffee, Egg Coffee, etc.), tapping an item with sizes (Iced Milk
Coffee) navigates to its Product Detail page. This is also the step that
proves Task 3's `MENU_ITEM_SELECT` PostgREST embed syntax actually works
end-to-end against the live database (Task 3 Step 12 only proved the
underlying joins resolve in plain SQL) — if this page throws or renders no
items, the embed syntax needs fixing before continuing.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(customer)/menu/page.tsx" components/customer/menu-browser.tsx
git commit -m "Wire Menu Browser to real categories/menu_items"
```

---

### Task 7: Wire Product Detail + shared mock rating constants

**Files:**
- Modify: `app/[locale]/(customer)/menu/[itemId]/page.tsx`
- Modify: `components/customer/product-detail.tsx`
- Modify: `lib/mock-data/reviews.ts`

**Interfaces:**
- Consumes: `getMenuItemById`, `MenuItem`, `MenuIcon` from
  `lib/supabase/menu-data.ts`.
- Produces: `MOCK_RATING`, `MOCK_REVIEW_COUNT` exported from
  `lib/mock-data/reviews.ts` — a single shared rating/count applied to
  every product now, replacing the old per-item `rating`/`reviewCount`
  mock fields that don't exist in the real schema (rating/reviews stay
  entirely mock, per the spec — this is the same "one shared set reused
  across every product" convention `MOCK_REVIEWS` already uses, just
  extended to also cover the numeric summary).

- [ ] **Step 1: Add the shared constants**

Add to `lib/mock-data/reviews.ts`, above `MOCK_REVIEWS`:

```ts
/**
 * Rating summary shown on every product — genuinely mock, not per-item.
 * There's no reviews table to aggregate a real average/count from; this
 * matches MOCK_REVIEWS below (one shared set of reviews reused across
 * every product) rather than inventing per-item precision that isn't real.
 */
export const MOCK_RATING = 4.5
export const MOCK_REVIEW_COUNT = 75
```

Also update this file's top docblock comment, which currently says "each
MenuItem's own `rating`/`reviewCount` (lib/mock-data/menu.ts) is what
actually varies per product" — that's no longer true, replace with:

```ts
/**
 * Placeholder reviews for the Product Detail page — no `reviews` table
 * yet. MOCK_RATING/MOCK_REVIEW_COUNT and this shared review list are both
 * reused identically across every product, not per-item content.
 */
```

- [ ] **Step 2: Real lookup in the page wrapper**

```tsx
// app/[locale]/(customer)/menu/[itemId]/page.tsx
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { ProductDetail } from "@/components/customer/product-detail"
import { createClient } from "@/lib/supabase/server"
import { getMenuItemById } from "@/lib/supabase/menu-data"

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ itemId: string }>
}) {
  const { itemId } = await params
  const supabase = await createClient()
  const item = await getMenuItemById(supabase, itemId)
  if (!item) notFound()

  const t = await getTranslations("Customer")
  return (
    <>
      <h1 className="sr-only">{t("menuTitle")}</h1>
      <ProductDetail item={item} />
    </>
  )
}
```

- [ ] **Step 3: Update `ProductDetail`'s types and rating display**

Change the imports at the top of `components/customer/product-detail.tsx`:

```tsx
import { MOCK_REVIEWS, MOCK_RATING, MOCK_REVIEW_COUNT } from "@/lib/mock-data/reviews"
import type { MenuItem, MenuIcon } from "@/lib/supabase/menu-data"
```

Every `item.rating !== undefined` guard becomes an unconditional render
using the shared constants instead. Two call sites:

```tsx
// near the top, below the description
<div className="mt-2 flex items-center gap-2">
  <StarRating rating={MOCK_RATING} />
  <span className="text-sm text-muted-foreground">
    {MOCK_RATING.toFixed(1)} · {tProduct("reviewCount", { count: MOCK_REVIEW_COUNT })}
  </span>
</div>
```

```tsx
// in the reviews section header
<div className="flex items-center gap-2">
  <span className="text-2xl font-bold text-primary">{MOCK_RATING.toFixed(1)}</span>
  <StarRating rating={MOCK_RATING} size="lg" />
</div>
```

(both are now unconditional — remove the surrounding `{item.rating !==
undefined && (...)}` wrappers). Every other reference to `item.sizes`,
`item.modifierGroups`, `item.imageUrl`, `item.basePrice`, `item.isAvailable`
is unchanged — same field names on the real `MenuItem` type as the mock
one had.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `product-detail.tsx`, its page wrapper, or
`reviews.ts`.

- [ ] **Step 5: Manual verification**

From `/en/menu`, tap "Iced Milk Coffee" (has both sizes and the milk
modifier group). Confirm: image/icon placeholder renders, rating shows
4.5 with the shared review count, size buttons (S/M/L) show correct price
deltas, the required milk modifier group renders with both options
pre-selecting the first, price updates live as size/modifier selection
changes, Add to Cart works and returns to `/menu`. Then tap "Black Coffee"
(no sizes/modifiers) and confirm those sections simply don't render.

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/(customer)/menu/[itemId]/page.tsx" components/customer/product-detail.tsx lib/mock-data/reviews.ts
git commit -m "Wire Product Detail to real menu_items, share mock rating"
```

---

### Task 8: Wire POS Terminal

**Files:**
- Modify: `app/[locale]/staff/pos/page.tsx`
- Modify: `components/staff/pos-terminal.tsx`

**Interfaces:**
- Consumes: `getCategories`, `getMenuItems`, `MenuCategory`, `MenuItem`
  from `lib/supabase/menu-data.ts`.

- [ ] **Step 1: Fetch in the page wrapper**

```tsx
// app/[locale]/staff/pos/page.tsx
import { getTranslations } from "next-intl/server"
import { StaffNav } from "@/components/staff/staff-nav"
import { PosTerminal } from "@/components/staff/pos-terminal"
import { createClient } from "@/lib/supabase/server"
import { getCategories, getMenuItems } from "@/lib/supabase/menu-data"

export default async function PosPage() {
  const t = await getTranslations("Staff")
  const supabase = await createClient()
  const [categories, items] = await Promise.all([getCategories(supabase), getMenuItems(supabase)])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <h1 className="sr-only">{t("posTitle")}</h1>
      <StaffNav />
      <div className="flex-1 overflow-hidden">
        <PosTerminal categories={categories} items={items} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Accept props in `PosTerminal`**

Replace the import and function signature in
`components/staff/pos-terminal.tsx`:

```tsx
import type { MenuCategory, MenuIcon, MenuItem } from "@/lib/supabase/menu-data"
```

(remove `import { menuCategories, menuItems, type MenuIcon, type MenuItem
} from "@/lib/mock-data/menu"`)

```tsx
export function PosTerminal({ categories, items }: { categories: MenuCategory[]; items: MenuItem[] }) {
  const locale = useLocale()
  const t = useTranslations("Pos")
  const { tables } = useTables()
  const { addOrder } = useKitchenOrders()

  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.id ?? "")
  const [searchQuery, setSearchQuery] = useState("")
  const [order, setOrder] = useState<OrderLine[]>([])
  const [orderType, setOrderType] = useState<OrderType>("dine-in")
  const [selectedTableId, setSelectedTableId] = useState(tables[0]?.id ?? "")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash")

  const selectedTable = tables.find((tbl) => tbl.id === selectedTableId) ?? tables[0]

  const name = (item: MenuItem) => (locale === "vi" ? item.nameVi : item.nameEn)
  const categoryLabel = (c: MenuCategory) => (locale === "vi" ? c.nameVi : c.nameEn)

  const visibleItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return items.filter((item) => {
      const matchesCategory = item.categoryId === selectedCategory
      const matchesQuery =
        query === "" || item.nameVi.toLowerCase().includes(query) || item.nameEn.toLowerCase().includes(query)
      return item.isAvailable && matchesCategory && matchesQuery
    })
  }, [items, selectedCategory, searchQuery])
```

Then replace the two remaining `menuCategories.map(...)` usages in the
JSX with `categories.map(...)`. Everything else (`addToOrder`,
`updateQuantity`, cart math, charge handler) reads `item.id`/`item.nameVi`/
`item.nameEn`/`item.basePrice`/`item.icon` — all unchanged field names.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `pos-terminal.tsx` or its page wrapper.

- [ ] **Step 4: Manual verification**

Log in as the admin test account (`admin@phadincoffee.dev` — has
`staff`-or-above access via role gating), navigate to `/en/staff/pos`.
Confirm: category tabs show real categories, only available items render
in the grid (Bạc Xỉu/White Coffee is `is_available: false`, should not
appear), tapping an item adds/increments it in the order panel, Charge
pushes a ticket onto the Kitchen Display board (`/en/staff/orders`) same
as before.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/staff/pos/page.tsx" components/staff/pos-terminal.tsx
git commit -m "Wire POS Terminal to real categories/menu_items"
```

---

### Task 9: Wire Admin Menu Management (real CRUD)

**Files:**
- Modify: `app/[locale]/admin/menu/page.tsx`
- Modify: `components/admin/menu-management.tsx`
- Modify: `components/admin/menu-item-form.tsx`

**Interfaces:**
- Consumes: `getCategories`, `getMenuItems`, `createMenuItem`,
  `updateMenuItem`, `deleteMenuItem`, `MenuCategory`, `MenuItem`,
  `MenuItemInput`, `MenuIcon` from `lib/supabase/menu-data.ts`;
  `createClient` from `lib/supabase/client.ts` (client-side — this page's
  mutations run from browser interaction, not a server fetch).

- [ ] **Step 1: Fetch initial data in the page wrapper**

```tsx
// app/[locale]/admin/menu/page.tsx
import { getTranslations } from "next-intl/server"
import { MenuManagement } from "@/components/admin/menu-management"
import { createClient } from "@/lib/supabase/server"
import { getCategories, getMenuItems } from "@/lib/supabase/menu-data"

export default async function AdminMenuPage() {
  const t = await getTranslations("Admin")
  const supabase = await createClient()
  const [categories, items] = await Promise.all([getCategories(supabase), getMenuItems(supabase)])

  return (
    <>
      <h1 className="sr-only">{t("menuTitle")}</h1>
      <MenuManagement categories={categories} initialItems={items} />
    </>
  )
}
```

- [ ] **Step 2: Rewire `MenuManagement` to real mutations**

In `components/admin/menu-management.tsx`, replace the top of the file:

```tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Coffee, CupSoda, Cookie, Milk, Search, Plus, Pencil, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatVND } from "@/lib/format"
import { createClient } from "@/lib/supabase/client"
import {
  createMenuItem,
  deleteMenuItem,
  updateMenuItem,
  type MenuCategory,
  type MenuIcon,
  type MenuItem,
  type MenuItemInput,
} from "@/lib/supabase/menu-data"
import { MenuItemForm } from "@/components/admin/menu-item-form"

const ICONS: Record<MenuIcon, typeof Coffee> = {
  coffee: Coffee,
  "cup-soda": CupSoda,
  cookie: Cookie,
  milk: Milk,
}

const PAGE_SIZE = 5

type FormMode = { type: "add" } | { type: "edit"; item: MenuItem } | null

export function MenuManagement({
  categories,
  initialItems,
}: {
  categories: MenuCategory[]
  initialItems: MenuItem[]
}) {
  const locale = useLocale()
  const t = useTranslations("AdminMenu")
  const supabase = createClient()

  const [items, setItems] = useState(initialItems)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [formMode, setFormMode] = useState<FormMode>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [error, setError] = useState<string | null>(null)

  const categoryLabel = (id: string) => {
    const category = categories.find((c) => c.id === id)
    if (!category) return id
    return locale === "vi" ? category.nameVi : category.nameEn
  }
```

`CATEGORY_BADGE_STYLES` loses its 4 hardcoded category-slug keys (`coffee`/
`tea`/`pastries`/`blended`) since categories are now real rows with real
UUIDs, not stable slugs — replace every `CATEGORY_BADGE_STYLES[item.categoryId]
?? "bg-muted text-muted-foreground"` usage in the JSX with a single
constant class string `"bg-accent/30 text-accent-foreground"` (one
consistent badge style for every category — a small, deliberate visual
simplification, not a regression, since there was no real per-category
brand meaning behind the 4 different colors to begin with).

Replace `visibleItems`'s filter (same logic, `items` is now the prop-seeded
state instead of the mock import — no change needed to the filter body
itself, already reads `item.categoryId`/`item.nameVi`/`item.nameEn`).

Remove `availability` state entirely (`useState<Record<string,
boolean>>` and its `useEffect` sync) — the real `MenuItem.isAvailable`
field on each `items` entry is now the single source of truth; replace
every `availability[item.id]` read with `item.isAvailable` directly.

Replace `toggleAvailability`, `removeItem`, `saveItem` with real,
error-handled async versions:

```tsx
  async function toggleAvailability(item: MenuItem) {
    setError(null)
    try {
      const updated = await updateMenuItem(supabase, item.id, {
        categoryId: item.categoryId,
        nameVi: item.nameVi,
        nameEn: item.nameEn,
        descriptionVi: item.descriptionVi,
        descriptionEn: item.descriptionEn,
        basePrice: item.basePrice,
        icon: item.icon,
        isAvailable: !item.isAvailable,
        isPopular: item.isPopular,
        imageUrl: item.imageUrl,
      })
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)))
    } catch {
      setError(t("saveError"))
    }
  }

  async function removeItem(id: string) {
    setError(null)
    try {
      await deleteMenuItem(supabase, id)
      setItems((prev) => prev.filter((item) => item.id !== id))
    } catch {
      setError(t("deleteError"))
    }
  }

  async function saveItem(input: MenuItemInput, editingId: string | null) {
    setError(null)
    try {
      const saved = editingId
        ? await updateMenuItem(supabase, editingId, input)
        : await createMenuItem(supabase, input)
      setItems((prev) =>
        editingId ? prev.map((item) => (item.id === editingId ? saved : item)) : [saved, ...prev]
      )
      setFormMode(null)
    } catch {
      setError(t("saveError"))
    }
  }
```

In the JSX: `onClick={() => toggleAvailability(item.id)}` becomes
`onClick={() => toggleAvailability(item)}`; the availability `<span>`'s
`isAvailable ? ...` condition reads `item.isAvailable` directly instead of
`availability[item.id]`; the `<MenuItemForm ... onSave={saveItem} .../>`
usage passes `categories={categories}` as a new prop (Step 3) and its
`onSave` callback signature changes from `(item: MenuItem) => void` to
`(input: MenuItemInput, editingId: string | null) => void` — update the
call site: `onSave={(input) => saveItem(input, formMode?.type === "edit" ?
formMode.item.id : null)}`. Add an error banner near the top of the
returned JSX, right after the header row: `{error && <p
className="rounded-lg bg-destructive/10 px-3 py-2 text-sm
text-destructive">{error}</p>}`.

Add two translation keys used above — `AdminMenu.saveError` and
`AdminMenu.deleteError` — to both `messages/en.json` ("Failed to save
item. Try again." / "Failed to delete item. Try again.") and
`messages/vi.json` ("Lưu món thất bại. Vui lòng thử lại." / "Xóa món thất
bại. Vui lòng thử lại.").

- [ ] **Step 3: Rewire `MenuItemForm` — real icon/isPopular fields, `MenuItemInput` output**

In `components/admin/menu-item-form.tsx`, replace the top of the file:

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { UploadCloud, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { MenuCategory, MenuIcon, MenuItem, MenuItemInput } from "@/lib/supabase/menu-data"

const ICON_OPTIONS: MenuIcon[] = ["coffee", "cup-soda", "cookie", "milk"]

export function MenuItemForm({
  categories,
  initialItem,
  onCancel,
  onSave,
}: {
  categories: MenuCategory[]
  initialItem?: MenuItem
  onCancel: () => void
  onSave: (input: MenuItemInput) => void
}) {
  const t = useTranslations("AdminMenu")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isEditing = Boolean(initialItem)

  const [nameVi, setNameVi] = useState(initialItem?.nameVi ?? "")
  const [nameEn, setNameEn] = useState(initialItem?.nameEn ?? "")
  const [categoryId, setCategoryId] = useState(initialItem?.categoryId ?? categories[0]?.id ?? "")
  const [price, setPrice] = useState(initialItem ? String(initialItem.basePrice) : "")
  const [descriptionVi, setDescriptionVi] = useState(initialItem?.descriptionVi ?? "")
  const [descriptionEn, setDescriptionEn] = useState(initialItem?.descriptionEn ?? "")
  const [icon, setIcon] = useState<MenuIcon>(initialItem?.icon ?? "coffee")
  const [isAvailable, setIsAvailable] = useState(initialItem?.isAvailable ?? true)
  const [isPopular, setIsPopular] = useState(initialItem?.isPopular ?? false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(initialItem?.imageUrl ?? null)
  const [ownsPreviewUrl, setOwnsPreviewUrl] = useState(false)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
```

(`imageFile`/`imagePreviewUrl`/`ownsPreviewUrl`/drag-drop handlers —
`selectFile`, `removeImage`, the cleanup `useEffect` — are all unchanged,
still local-only per the spec's explicit scope boundary).

Replace `handleSave`:

```tsx
  function handleSave() {
    const parsedPrice = Number(price)
    if (!nameVi.trim() || !nameEn.trim() || !categoryId || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError(t("requiredFieldsError"))
      return
    }

    onSave({
      categoryId,
      nameVi: nameVi.trim(),
      nameEn: nameEn.trim(),
      descriptionVi: descriptionVi.trim(),
      descriptionEn: descriptionEn.trim(),
      basePrice: parsedPrice,
      icon,
      isAvailable,
      isPopular,
      imageUrl: imagePreviewUrl,
    })
  }
```

Replace the category `<select>`'s options
(`menuCategories.map(...) → category.labelVi / category.labelEn`) with
`categories.map((category) => (<option key={category.id}
value={category.id}>{category.nameVi} / {category.nameEn}</option>))`.

Add an icon picker and a Popular toggle, right after the existing
"Available" toggle block (same `role="switch"` pattern already used
elsewhere in this file):

```tsx
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t("iconLabel")}</label>
            <div className="flex gap-2">
              {ICON_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setIcon(option)}
                  aria-pressed={icon === option}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg border-2 transition-colors",
                    icon === option ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground"
                  )}
                >
                  {option === "coffee" && <span className="text-lg">☕</span>}
                  {option === "cup-soda" && <span className="text-lg">🥤</span>}
                  {option === "cookie" && <span className="text-lg">🍪</span>}
                  {option === "milk" && <span className="text-lg">🥛</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm font-medium text-card-foreground">{t("popularToggle")}</span>
            <button
              type="button"
              role="switch"
              aria-checked={isPopular}
              onClick={() => setIsPopular((prev) => !prev)}
              className={cn(
                "relative h-6 w-11 rounded-full transition-colors",
                isPopular ? "bg-primary" : "bg-muted-foreground/30"
              )}
            >
              <span
                className={cn(
                  "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                  isPopular ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>
```

Add `AdminMenu.iconLabel` ("Icon" / "Biểu Tượng") and
`AdminMenu.popularToggle` ("Featured / Best Seller" / "Nổi Bật") to both
message files.

- [ ] **Step 4: Update the call site passing `categories` into `MenuItemForm`**

Back in `menu-management.tsx`, the `<MenuItemForm .../>` render already
updated in Step 2 needs `categories={categories}` added alongside its
other props.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `menu-management.tsx`, `menu-item-form.tsx`, or the
page wrapper.

- [ ] **Step 6: Manual verification — full CRUD round-trip**

Log in as `admin@phadincoffee.dev`, navigate to `/en/admin/menu`. Confirm:
- Table shows all 9 real items with correct category/price/availability.
- Toggle an item's availability switch — confirm the badge flips
  immediately and (reload the page) the change persisted.
- Click Edit on "Iced Milk Coffee" — form pre-fills every field including
  icon (☕) and the Popular toggle (on). Change the price, save, confirm
  the table row updates and reload shows the new price.
- Click "Add Item" — fill in a new item ("Cà Phê Muối" / "Salt Coffee",
  30000, any category, cookie icon), save, confirm it appears at the top
  of the table and reload still shows it.
- Delete that same test item, confirm it disappears and reload confirms
  it's really gone from the database (not just local state).
- Navigate to `/en/menu` and confirm the availability toggle from earlier
  is reflected there too (same underlying row).

- [ ] **Step 7: Commit**

```bash
git add "app/[locale]/admin/menu/page.tsx" components/admin/menu-management.tsx components/admin/menu-item-form.tsx messages/en.json messages/vi.json
git commit -m "Wire Admin Menu Management to real CRUD, add icon/popular fields"
```

---

### Task 10: Retire the mock file, final full-app verification

**Files:**
- Delete: `lib/mock-data/menu.ts`
- Modify: `CLAUDE.md` (update the "Customer ordering flow" section's
  reference to `lib/mock-data/menu.ts` as a live data source)

**Interfaces:**
- Consumes: nothing — this task only removes the now-unused file and
  confirms nothing still references it.

- [ ] **Step 1: Confirm nothing still imports the mock file**

Run: `grep -rn "mock-data/menu" --include="*.ts" --include="*.tsx" .`
Expected: zero matches in `components/`, `app/`, `lib/` (matches in
`docs/`/`CLAUDE.md`/`daily.md`/`continuity.md` are fine — those are prose,
not imports).

- [ ] **Step 2: Delete the file**

```bash
rm lib/mock-data/menu.ts
```

- [ ] **Step 3: Update CLAUDE.md**

Find the `lib/mock-data/menu.ts` bullet under "Customer ordering flow"
(currently describes it as "placeholder menu items/categories/sizes/
modifiers until `menu_items` etc. exist in Supabase") and replace it with
a note that this is now real data — `lib/supabase/menu-data.ts` is the
real query module, seeded via migrations `0008`/`0009`.

- [ ] **Step 4: Full build + typecheck + lint**

```bash
npm run build
npx tsc --noEmit
npx eslint .
```

Expected: all three clean.

- [ ] **Step 5: Full manual pass**

Using a real browser (Playwright or by hand): visit `/en` (Landing),
`/en/menu` (browse, search, filter), `/en/menu/{a real item id}` (Product
Detail, add to cart with size+modifier), `/en/cart`, `/en/checkout` (place
a cash order — this still uses the existing mock `useOrders`/`addOrder`
flow since Stripe/place-order is a separate future plan; confirm it still
works with real cart items sourced from real menu data), `/en/staff/pos`
(as staff/admin), `/en/admin/menu` (CRUD, already covered in Task 9 but
worth a final click-through in context). Confirm zero console errors
across all of these.

- [ ] **Step 6: Run the test suite one more time**

Run: `npm test`
Expected: PASS (all tests from Tasks 3-4).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Retire lib/mock-data/menu.ts now that real menu data is live everywhere"
```

---

## Plan Self-Review Notes

- **Spec coverage:** every item in the design doc's "Part 1: Menu Data
  Migration" section has a task — schema (Task 1), seed (Task 2), the
  shared query module (Tasks 3-4), and all four originally-listed
  consumers (Menu Browser: Task 6, Product Detail: Task 7, POS: Task 8,
  Admin Menu Management: Task 9) plus one the spec's consumer table
  missed — Landing's best-sellers section (Task 5), found by grepping
  every actual `mock-data/menu` import in the codebase rather than trusting
  the spec's list at face value.
- **`is_popular` reconciles a pre-existing inconsistency:** the old mock
  data had Landing's best-sellers hardcode 3 specific item ids
  independently of each item's own (mostly-unset) `isPopular` field — Task
  2's seed data deliberately unifies these into one real, consistent flag
  rather than carrying the inconsistency forward.
- **Item count correction:** the design doc said "8 items"; recounting the
  actual mock data in Task 2 found 9 (4 Coffee, 2 Tea, 2 Pastries, 1
  Blended) — fixed in Task 2's verification step rather than left wrong.
