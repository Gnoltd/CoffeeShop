# Coffee Shop App Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the full structural skeleton of the Coffee Shop app (Next.js app, Supabase schema/RLS/Edge Functions, route structure, tracking docs) per `docs/superpowers/specs/2026-07-04-coffee-shop-app-design.md` — no business logic, no UI design polish.

**Architecture:** Single Next.js (App Router) project talking directly to Supabase (Postgres + Auth + Realtime) via its SDK, with Row Level Security as the real access-control boundary and a handful of Edge Functions for logic needing secrets/atomicity. See the spec for full rationale.

**Tech Stack:** Next.js (TypeScript, App Router), Tailwind CSS, shadcn/ui, Supabase (Postgres, Auth, Realtime, Edge Functions/Deno), Vitest + React Testing Library, `pg` (Node Postgres client for schema tests), npm.

## Global Constraints

- Node.js 20+ and npm (project uses npm exclusively — no yarn/pnpm lockfiles).
- Docker Desktop must be running before any task that starts local Supabase (`npx supabase start`).
- Supabase CLI is invoked via `npx supabase` — no global install required.
- Local Supabase default ports (Supabase CLI defaults, unless `supabase/config.toml` is changed): API `54321`, Postgres `54322`, Studio `54323`.
- All monetary amounts are stored as **integers in VND** (no decimal subunits).
- **Deviation from the spec's literal folder-tree notation:** Next.js route groups (parenthesized folders) are invisible in the URL, so the spec's `(staff)` and `(admin)` route groups would collide with `(customer)` on bare paths like `/menu` and `/orders`. This plan fixes that by making `staff/` and `admin/` **real URL-segment folders** (`/staff/*`, `/admin/*` — matching the literal paths already used in the spec's Section 6 prose), and folding the spec's `(public)` menu-browse page into the single `(customer)/menu` page (there is one menu page, not two — it's publicly viewable regardless of auth state). All intended routes, features, and RLS boundaries from the spec are preserved; only the folder-grouping mechanics change.
- **Deferred to a later phase (per spec's "Next Steps"):** per-page auth redirects for customer pages (e.g. redirecting an anonymous user away from `/checkout` or `/profile`), all Stripe/VNPay/order business logic inside Edge Functions, and all visual/UI design. This plan scaffolds routes, schema, RLS, and working-but-minimal Edge Function handlers only.

---

### Task 1: Scaffold Next.js project with Tailwind + shadcn/ui

**Files:**
- Create: entire Next.js project skeleton at repo root (via `create-next-app`)
- Create: `components/ui/button.tsx`, `components/ui/card.tsx` (via shadcn CLI)
- Modify: `app/page.tsx` (temporary — replaced in Task 13)

**Interfaces:**
- Produces: a buildable Next.js + Tailwind + TypeScript project at the repo root with shadcn/ui configured (`components.json`, `lib/utils.ts` with `cn()` helper).

- [ ] **Step 1: Scaffold Next.js into a temp directory (avoids create-next-app's non-empty-directory check against the existing `docs/` folder)**

```bash
cd ..
npx create-next-app@latest coffeeshop-tmp --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*" --use-npm --no-turbopack
rm -rf coffeeshop-tmp/.git
```

- [ ] **Step 2: Move the scaffolded project into the repo root**

```bash
cp -r coffeeshop-tmp/. CoffeeShop/
rm -rf coffeeshop-tmp
cd CoffeeShop
```

- [ ] **Step 3: Verify it builds**

Run: `npm run build`
Expected: build completes with no errors (default Next.js starter page).

- [ ] **Step 4: Initialize shadcn/ui and add base components**

```bash
npx shadcn@latest init --yes
npx shadcn@latest add button card
```

If the CLI prompts interactively despite `--yes` (version-dependent), accept the defaults offered (default style, default base color/Slate or Neutral, CSS variables: yes).

- [ ] **Step 5: Prove shadcn/ui works by rendering both components on the temporary home page**

Edit `app/page.tsx`:
```tsx
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function Home() {
  return (
    <main className="p-8">
      <Card>
        <CardContent className="p-6">
          <p className="mb-4">shadcn/ui scaffold check</p>
          <Button>Click me</Button>
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 6: Verify build and dev server**

Run: `npm run build`
Expected: build succeeds.

Run: `npm run dev` (then stop it once confirmed)
Expected: `http://localhost:3000` renders a card with a button, no console errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Tailwind and shadcn/ui"
```

---

### Task 2: Supabase client libraries + Vitest/RTL test setup

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/client.test.ts`
- Create: `lib/supabase/server.test.ts`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Modify: `package.json` (add `test`, `test:watch`, `db:start`, `db:reset` scripts)

**Interfaces:**
- Produces: `createClient()` (browser, sync, from `lib/supabase/client.ts`) and `createClient()` (server, async, from `lib/supabase/server.ts`) — both return a Supabase JS client. Later tasks (middleware, pages) import these by these exact names/paths.

- [ ] **Step 1: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event pg @types/pg
```

- [ ] **Step 2: Configure Vitest**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
```

Create `vitest.setup.ts`:
```ts
import "@testing-library/jest-dom/vitest"
```

Add to `package.json` `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest",
"db:start": "supabase start",
"db:reset": "supabase db reset"
```

- [ ] **Step 3: Write the failing test for the browser client**

Create `lib/supabase/client.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from "vitest"

describe("browser supabase client", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key")
  })

  it("creates a client exposing auth and from()", async () => {
    const { createClient } = await import("./client")
    const client = createClient()
    expect(typeof client.auth.getUser).toBe("function")
    expect(typeof client.from).toBe("function")
  })
})
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npx vitest run lib/supabase/client.test.ts`
Expected: FAIL — `Cannot find module './client'`

- [ ] **Step 5: Implement the browser client**

Create `lib/supabase/client.ts`:
```ts
import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 6: Run it to verify it passes**

Run: `npx vitest run lib/supabase/client.test.ts`
Expected: PASS

- [ ] **Step 7: Write the failing test for the server client**

Create `lib/supabase/server.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
    set: () => {},
  }),
}))

describe("server supabase client", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key")
  })

  it("creates a client exposing auth and from()", async () => {
    const { createClient } = await import("./server")
    const client = await createClient()
    expect(typeof client.auth.getUser).toBe("function")
    expect(typeof client.from).toBe("function")
  })
})
```

- [ ] **Step 8: Run it to verify it fails**

Run: `npx vitest run lib/supabase/server.test.ts`
Expected: FAIL — `Cannot find module './server'`

- [ ] **Step 9: Implement the server client**

Create `lib/supabase/server.ts`:
```ts
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // called from a Server Component with no writable cookie store — safe to ignore
          }
        },
      },
    }
  )
}
```

- [ ] **Step 10: Run it to verify it passes**

Run: `npx vitest run lib/supabase/server.test.ts`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts lib/supabase
git commit -m "feat: add Supabase client helpers and Vitest test setup"
```

---

### Task 3: DB schema — Identity & Roles

**Files:**
- Create: `supabase/migrations/<timestamp>_identity_and_roles.sql` (filename timestamp generated by the CLI in Step 1)
- Create: `supabase/tests/db.ts`
- Create: `supabase/tests/identity_and_roles.test.ts`

**Interfaces:**
- Produces: `user_role` enum (`customer|staff|manager|admin`), `public.profiles` table, `public.current_user_role()` SQL function (used by every later RLS policy task), `handle_new_user()` trigger (auto-creates a profile on signup), `prevent_role_self_change()` trigger (blocks non-admins from changing their own `role`).
- Produces: `supabase/tests/db.ts` exporting `createDbClient()` — a `pg.Client` factory pointed at local Supabase Postgres, reused by every later DB test task.

- [ ] **Step 1: Generate the migration file**

```bash
npx supabase init
npx supabase migration new identity_and_roles
```

Note the generated path (e.g. `supabase/migrations/20260704120000_identity_and_roles.sql`) — use it for the rest of this task.

- [ ] **Step 2: Write the migration**

```sql
create type user_role as enum ('customer', 'staff', 'manager', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  role user_role not null default 'customer',
  loyalty_points_balance integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.prevent_role_self_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and public.current_user_role() is distinct from 'admin' then
    raise exception 'only an admin can change a profile role';
  end if;
  return new;
end;
$$;

create trigger on_profile_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_self_change();

create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

create policy "profiles_select_staff" on public.profiles
  for select using (public.current_user_role() in ('staff', 'manager', 'admin'));

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "profiles_update_admin" on public.profiles
  for update using (public.current_user_role() = 'admin');
```

- [ ] **Step 3: Start local Supabase and apply the migration**

```bash
npx supabase start
npx supabase db reset
```

Expected: no SQL errors; command prints the local API URL, anon key, and service role key. Copy those three values into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (create the file if it doesn't exist yet).

- [ ] **Step 4: Write the shared DB test client**

Create `supabase/tests/db.ts`:
```ts
import { Client } from "pg"

export function createDbClient() {
  return new Client({
    connectionString:
      process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  })
}
```

- [ ] **Step 5: Write the failing test**

Create `supabase/tests/identity_and_roles.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createDbClient } from "./db"
import type { Client } from "pg"

let db: Client

beforeAll(async () => {
  db = createDbClient()
  await db.connect()
})

afterAll(async () => {
  await db.end()
})

describe("identity_and_roles migration", () => {
  it("creates the user_role enum with 4 values in order", async () => {
    const res = await db.query(
      `select enumlabel from pg_enum e join pg_type t on e.enumtypid = t.oid where t.typname = 'user_role' order by enumsortorder`
    )
    expect(res.rows.map((r) => r.enumlabel)).toEqual(["customer", "staff", "manager", "admin"])
  })

  it("creates the profiles table with the expected columns", async () => {
    const res = await db.query(
      `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'profiles' order by column_name`
    )
    expect(res.rows.map((r) => r.column_name)).toEqual(
      ["avatar_url", "created_at", "full_name", "id", "loyalty_points_balance", "phone", "role"].sort()
    )
  })

  it("enables row level security on profiles", async () => {
    const res = await db.query(
      `select relrowsecurity from pg_class where relname = 'profiles' and relnamespace = 'public'::regnamespace`
    )
    expect(res.rows[0].relrowsecurity).toBe(true)
  })

  it("auto-creates a profile with role 'customer' when a new auth user is inserted", async () => {
    const email = `test-${Date.now()}@example.com`
    const insertUser = await db.query(
      `insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
       values (gen_random_uuid(), $1, 'x', now(), '{}', '{}') returning id`,
      [email]
    )
    const userId = insertUser.rows[0].id
    const profile = await db.query(`select role from public.profiles where id = $1`, [userId])
    expect(profile.rows).toHaveLength(1)
    expect(profile.rows[0].role).toBe("customer")
  })
})
```

If the `auth.users` insert fails with a NOT NULL violation on a column not listed above, that column lacks a default in your installed Supabase CLI version — add it explicitly (e.g. `instance_id` with value `'00000000-0000-0000-0000-000000000000'`) and retry; Supabase's `auth` schema has varied slightly across CLI versions.

- [ ] **Step 6: Run it to verify it fails, then passes**

Run: `npx vitest run supabase/tests/identity_and_roles.test.ts`
Expected first run: FAIL (migration not yet applied, if Step 3 was skipped) — otherwise this should already PASS since Step 3 applied the migration before the test was written. Run it now to confirm: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase .env.local.example 2>/dev/null; git add supabase
git commit -m "feat(db): add identity/roles schema, current_user_role(), auto-profile trigger, RLS"
```

---

### Task 4: DB schema — Shop Config

**Files:**
- Create: `supabase/migrations/<timestamp>_shop_config.sql`
- Create: `supabase/tests/shop_config.test.ts`

**Interfaces:**
- Produces: `public.shop_settings` (single row, id=1), `public.loyalty_settings` (single row, id=1, `earn_rate_vnd_per_point` default 10000, `redeem_value_vnd_per_point` default 100) — consumed by the `handle_order_paid()` trigger in Task 9 and by the customer loyalty page later.

- [ ] **Step 1: Generate the migration**

```bash
npx supabase migration new shop_config
```

- [ ] **Step 2: Write the migration**

```sql
create table public.shop_settings (
  id smallint primary key default 1,
  shop_name text not null default 'My Coffee Shop',
  address text,
  phone text,
  opening_hours text,
  tax_rate numeric(5,4) not null default 0,
  constraint shop_settings_single_row check (id = 1)
);
insert into public.shop_settings (id) values (1);
alter table public.shop_settings enable row level security;

create table public.loyalty_settings (
  id smallint primary key default 1,
  earn_rate_vnd_per_point integer not null default 10000,
  redeem_value_vnd_per_point integer not null default 100,
  constraint loyalty_settings_single_row check (id = 1)
);
insert into public.loyalty_settings (id) values (1);
alter table public.loyalty_settings enable row level security;

create policy "shop_settings_select_all" on public.shop_settings
  for select using (true);
create policy "shop_settings_update_admin" on public.shop_settings
  for update using (public.current_user_role() in ('manager', 'admin'));

create policy "loyalty_settings_select_all" on public.loyalty_settings
  for select using (true);
create policy "loyalty_settings_update_admin" on public.loyalty_settings
  for update using (public.current_user_role() in ('manager', 'admin'));
```

- [ ] **Step 3: Reset local DB to apply**

Run: `npx supabase db reset`
Expected: no SQL errors.

- [ ] **Step 4: Write the failing test**

Create `supabase/tests/shop_config.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createDbClient } from "./db"
import type { Client } from "pg"

let db: Client

beforeAll(async () => {
  db = createDbClient()
  await db.connect()
})

afterAll(async () => {
  await db.end()
})

describe("shop_config migration", () => {
  it("seeds a single shop_settings row with default loyalty-independent values", async () => {
    const res = await db.query(`select shop_name, tax_rate from public.shop_settings where id = 1`)
    expect(res.rows).toHaveLength(1)
    expect(res.rows[0].shop_name).toBe("My Coffee Shop")
  })

  it("seeds loyalty_settings with the agreed default rates (10,000 VND = 1 point, 100 points = 10,000 VND)", async () => {
    const res = await db.query(
      `select earn_rate_vnd_per_point, redeem_value_vnd_per_point from public.loyalty_settings where id = 1`
    )
    expect(res.rows[0].earn_rate_vnd_per_point).toBe(10000)
    expect(res.rows[0].redeem_value_vnd_per_point).toBe(100)
  })

  it("rejects a second shop_settings row", async () => {
    await expect(
      db.query(`insert into public.shop_settings (id, shop_name) values (2, 'Other')`)
    ).rejects.toThrow()
  })
})
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run supabase/tests/shop_config.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add supabase
git commit -m "feat(db): add shop_settings and loyalty_settings config tables"
```

---

### Task 5: DB schema — Menu

**Files:**
- Create: `supabase/migrations/<timestamp>_menu.sql`
- Create: `supabase/tests/menu.test.ts`

**Interfaces:**
- Produces: `public.categories`, `public.menu_items`, `public.menu_item_sizes`, `public.modifier_groups`, `public.modifiers`, `public.menu_item_modifier_groups` — consumed by Task 6 (BOM tables reference `menu_items`/`modifiers`) and Task 7 (`order_items` references `menu_items`/`menu_item_sizes`, `order_item_modifiers` references `modifiers`).

- [ ] **Step 1: Generate the migration**

```bash
npx supabase migration new menu
```

- [ ] **Step 2: Write the migration**

```sql
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0
);
alter table public.categories enable row level security;

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null,
  description text,
  base_price integer not null,
  image_url text,
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.menu_items enable row level security;

create table public.menu_item_sizes (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  name text not null,
  price_delta integer not null default 0
);
alter table public.menu_item_sizes enable row level security;

create table public.modifier_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_required boolean not null default false,
  max_selections integer not null default 1
);
alter table public.modifier_groups enable row level security;

create table public.modifiers (
  id uuid primary key default gen_random_uuid(),
  modifier_group_id uuid not null references public.modifier_groups(id) on delete cascade,
  name text not null,
  price_delta integer not null default 0
);
alter table public.modifiers enable row level security;

create table public.menu_item_modifier_groups (
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  modifier_group_id uuid not null references public.modifier_groups(id) on delete cascade,
  primary key (menu_item_id, modifier_group_id)
);
alter table public.menu_item_modifier_groups enable row level security;

create policy "categories_select_all" on public.categories for select using (true);
create policy "categories_admin_all" on public.categories for all
  using (public.current_user_role() in ('manager', 'admin'))
  with check (public.current_user_role() in ('manager', 'admin'));

create policy "menu_items_select_all" on public.menu_items for select using (true);
create policy "menu_items_admin_all" on public.menu_items for all
  using (public.current_user_role() in ('manager', 'admin'))
  with check (public.current_user_role() in ('manager', 'admin'));

create policy "menu_item_sizes_select_all" on public.menu_item_sizes for select using (true);
create policy "menu_item_sizes_admin_all" on public.menu_item_sizes for all
  using (public.current_user_role() in ('manager', 'admin'))
  with check (public.current_user_role() in ('manager', 'admin'));

create policy "modifier_groups_select_all" on public.modifier_groups for select using (true);
create policy "modifier_groups_admin_all" on public.modifier_groups for all
  using (public.current_user_role() in ('manager', 'admin'))
  with check (public.current_user_role() in ('manager', 'admin'));

create policy "modifiers_select_all" on public.modifiers for select using (true);
create policy "modifiers_admin_all" on public.modifiers for all
  using (public.current_user_role() in ('manager', 'admin'))
  with check (public.current_user_role() in ('manager', 'admin'));

create policy "menu_item_modifier_groups_select_all" on public.menu_item_modifier_groups for select using (true);
create policy "menu_item_modifier_groups_admin_all" on public.menu_item_modifier_groups for all
  using (public.current_user_role() in ('manager', 'admin'))
  with check (public.current_user_role() in ('manager', 'admin'));
```

- [ ] **Step 3: Reset local DB to apply**

Run: `npx supabase db reset`
Expected: no SQL errors.

- [ ] **Step 4: Write the failing test**

Create `supabase/tests/menu.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createDbClient } from "./db"
import type { Client } from "pg"

let db: Client

beforeAll(async () => {
  db = createDbClient()
  await db.connect()
})

afterAll(async () => {
  await db.end()
})

describe("menu migration", () => {
  it("creates all six menu tables", async () => {
    const res = await db.query(
      `select table_name from information_schema.tables where table_schema = 'public' and table_name in
       ('categories', 'menu_items', 'menu_item_sizes', 'modifier_groups', 'modifiers', 'menu_item_modifier_groups')`
    )
    expect(res.rows.map((r) => r.table_name).sort()).toEqual(
      ["categories", "menu_item_modifier_groups", "menu_item_sizes", "menu_items", "modifier_groups", "modifiers"].sort()
    )
  })

  it("lets a modifier group be linked to a menu item via the join table", async () => {
    const category = await db.query(`insert into public.categories (name) values ('Coffee') returning id`)
    const item = await db.query(
      `insert into public.menu_items (category_id, name, base_price) values ($1, 'Latte', 45000) returning id`,
      [category.rows[0].id]
    )
    const group = await db.query(
      `insert into public.modifier_groups (name, max_selections) values ('Milk Options', 1) returning id`
    )
    await db.query(
      `insert into public.menu_item_modifier_groups (menu_item_id, modifier_group_id) values ($1, $2)`,
      [item.rows[0].id, group.rows[0].id]
    )
    const link = await db.query(
      `select * from public.menu_item_modifier_groups where menu_item_id = $1 and modifier_group_id = $2`,
      [item.rows[0].id, group.rows[0].id]
    )
    expect(link.rows).toHaveLength(1)
  })
})
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run supabase/tests/menu.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add supabase
git commit -m "feat(db): add menu schema (categories, items, sizes, modifiers) with RLS"
```

---

### Task 6: DB schema — Inventory

**Files:**
- Create: `supabase/migrations/<timestamp>_inventory.sql`
- Create: `supabase/tests/inventory.test.ts`

**Interfaces:**
- Produces: `public.ingredients`, `public.menu_item_ingredients`, `public.modifier_ingredients`, `public.inventory_logs` (with `inventory_log_reason` enum) — `inventory_logs.reference_order_id` is added as a plain `uuid` column here (no FK yet); Task 7 adds the FK to `orders` once that table exists. Consumed by the `handle_order_paid()` trigger in Task 9.

- [ ] **Step 1: Generate the migration**

```bash
npx supabase migration new inventory
```

- [ ] **Step 2: Write the migration**

```sql
create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null,
  stock_quantity numeric(10,2) not null default 0,
  low_stock_threshold numeric(10,2) not null default 0
);
alter table public.ingredients enable row level security;

create table public.menu_item_ingredients (
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  quantity_used numeric(10,2) not null,
  primary key (menu_item_id, ingredient_id)
);
alter table public.menu_item_ingredients enable row level security;

create table public.modifier_ingredients (
  modifier_id uuid not null references public.modifiers(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  quantity_used numeric(10,2) not null,
  primary key (modifier_id, ingredient_id)
);
alter table public.modifier_ingredients enable row level security;

create type inventory_log_reason as enum ('order_deduction', 'restock', 'adjustment', 'waste');

create table public.inventory_logs (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  change_quantity numeric(10,2) not null,
  reason inventory_log_reason not null,
  reference_order_id uuid,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.inventory_logs enable row level security;

create policy "ingredients_select_staff" on public.ingredients for select
  using (public.current_user_role() in ('staff', 'manager', 'admin'));
create policy "ingredients_admin_all" on public.ingredients for all
  using (public.current_user_role() in ('manager', 'admin'))
  with check (public.current_user_role() in ('manager', 'admin'));

create policy "menu_item_ingredients_select_staff" on public.menu_item_ingredients for select
  using (public.current_user_role() in ('staff', 'manager', 'admin'));
create policy "menu_item_ingredients_admin_all" on public.menu_item_ingredients for all
  using (public.current_user_role() in ('manager', 'admin'))
  with check (public.current_user_role() in ('manager', 'admin'));

create policy "modifier_ingredients_select_staff" on public.modifier_ingredients for select
  using (public.current_user_role() in ('staff', 'manager', 'admin'));
create policy "modifier_ingredients_admin_all" on public.modifier_ingredients for all
  using (public.current_user_role() in ('manager', 'admin'))
  with check (public.current_user_role() in ('manager', 'admin'));

create policy "inventory_logs_select_staff" on public.inventory_logs for select
  using (public.current_user_role() in ('staff', 'manager', 'admin'));
create policy "inventory_logs_admin_all" on public.inventory_logs for all
  using (public.current_user_role() in ('manager', 'admin'))
  with check (public.current_user_role() in ('manager', 'admin'));
```

- [ ] **Step 3: Reset local DB to apply**

Run: `npx supabase db reset`
Expected: no SQL errors.

- [ ] **Step 4: Write the failing test**

Create `supabase/tests/inventory.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createDbClient } from "./db"
import type { Client } from "pg"

let db: Client

beforeAll(async () => {
  db = createDbClient()
  await db.connect()
})

afterAll(async () => {
  await db.end()
})

describe("inventory migration", () => {
  it("creates the inventory_log_reason enum with 4 values", async () => {
    const res = await db.query(
      `select enumlabel from pg_enum e join pg_type t on e.enumtypid = t.oid where t.typname = 'inventory_log_reason' order by enumsortorder`
    )
    expect(res.rows.map((r) => r.enumlabel)).toEqual(["order_deduction", "restock", "adjustment", "waste"])
  })

  it("links an ingredient to a menu item via a BOM entry", async () => {
    const category = await db.query(`insert into public.categories (name) values ('Coffee') returning id`)
    const item = await db.query(
      `insert into public.menu_items (category_id, name, base_price) values ($1, 'Latte', 45000) returning id`,
      [category.rows[0].id]
    )
    const ingredient = await db.query(
      `insert into public.ingredients (name, unit, stock_quantity, low_stock_threshold) values ('Milk', 'ml', 1000, 200) returning id`
    )
    await db.query(
      `insert into public.menu_item_ingredients (menu_item_id, ingredient_id, quantity_used) values ($1, $2, 200)`,
      [item.rows[0].id, ingredient.rows[0].id]
    )
    const bom = await db.query(
      `select quantity_used from public.menu_item_ingredients where menu_item_id = $1 and ingredient_id = $2`,
      [item.rows[0].id, ingredient.rows[0].id]
    )
    expect(Number(bom.rows[0].quantity_used)).toBe(200)
  })

  it("inventory_logs.reference_order_id has no FK constraint yet (added in the orders migration)", async () => {
    const res = await db.query(
      `select count(*)::int as count from information_schema.table_constraints
       where table_name = 'inventory_logs' and constraint_type = 'FOREIGN KEY'
       and constraint_name like '%reference_order_id%'`
    )
    expect(res.rows[0].count).toBe(0)
  })
})
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run supabase/tests/inventory.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add supabase
git commit -m "feat(db): add inventory schema (ingredients, BOM tables, inventory_logs) with RLS"
```

---

### Task 7: DB schema — Dine-in & Orders

**Files:**
- Create: `supabase/migrations/<timestamp>_orders.sql`
- Create: `supabase/tests/orders.test.ts`

**Interfaces:**
- Produces: `public.tables`, `public.orders` (with `order_type`, `order_status`, `payment_method`, `payment_status` enums), `public.order_items`, `public.order_item_modifiers`. Adds the deferred FK `inventory_logs.reference_order_id → orders.id`. Consumed by Task 8 (`payment_transactions`/`loyalty_transactions` reference `orders`) and Task 9 (the paid-order trigger).

- [ ] **Step 1: Generate the migration**

```bash
npx supabase migration new orders
```

- [ ] **Step 2: Write the migration**

```sql
create table public.tables (
  id uuid primary key default gen_random_uuid(),
  table_number text not null unique,
  qr_code_token text not null unique default encode(gen_random_bytes(16), 'hex')
);
alter table public.tables enable row level security;

create type order_type as enum ('pickup', 'dine_in');
create type order_status as enum ('pending_payment', 'paid', 'preparing', 'ready', 'completed', 'cancelled');
create type payment_method as enum ('stripe', 'cash', 'vnpay');
create type payment_status as enum ('pending', 'paid', 'failed', 'refunded');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id),
  order_type order_type not null,
  table_id uuid references public.tables(id),
  status order_status not null default 'pending_payment',
  payment_method payment_method not null,
  payment_status payment_status not null default 'pending',
  subtotal integer not null,
  discount_amount integer not null default 0,
  loyalty_points_used integer not null default 0,
  loyalty_points_earned integer not null default 0,
  total integer not null,
  pickup_time timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.orders enable row level security;

alter table public.inventory_logs
  add constraint inventory_logs_reference_order_id_fkey
  foreign key (reference_order_id) references public.orders(id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id),
  size_id uuid references public.menu_item_sizes(id),
  quantity integer not null default 1,
  unit_price integer not null,
  subtotal integer not null
);
alter table public.order_items enable row level security;

create table public.order_item_modifiers (
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  modifier_id uuid not null references public.modifiers(id),
  price_delta integer not null,
  primary key (order_item_id, modifier_id)
);
alter table public.order_item_modifiers enable row level security;

create policy "tables_select_all" on public.tables for select using (true);
create policy "tables_admin_all" on public.tables for all
  using (public.current_user_role() in ('manager', 'admin'))
  with check (public.current_user_role() in ('manager', 'admin'));

create policy "orders_select_own" on public.orders for select using (customer_id = auth.uid());
create policy "orders_select_staff" on public.orders for select
  using (public.current_user_role() in ('staff', 'manager', 'admin'));
create policy "orders_insert" on public.orders for insert
  with check (customer_id = auth.uid() or public.current_user_role() in ('staff', 'manager', 'admin'));
create policy "orders_update_staff" on public.orders for update
  using (public.current_user_role() in ('staff', 'manager', 'admin'));

create policy "order_items_select" on public.order_items for select
  using (exists (
    select 1 from public.orders o where o.id = order_items.order_id
    and (o.customer_id = auth.uid() or public.current_user_role() in ('staff', 'manager', 'admin'))
  ));
create policy "order_items_insert" on public.order_items for insert
  with check (exists (
    select 1 from public.orders o where o.id = order_items.order_id
    and (o.customer_id = auth.uid() or public.current_user_role() in ('staff', 'manager', 'admin'))
  ));

create policy "order_item_modifiers_select" on public.order_item_modifiers for select
  using (exists (
    select 1 from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.id = order_item_modifiers.order_item_id
    and (o.customer_id = auth.uid() or public.current_user_role() in ('staff', 'manager', 'admin'))
  ));
create policy "order_item_modifiers_insert" on public.order_item_modifiers for insert
  with check (exists (
    select 1 from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.id = order_item_modifiers.order_item_id
    and (o.customer_id = auth.uid() or public.current_user_role() in ('staff', 'manager', 'admin'))
  ));
```

- [ ] **Step 3: Reset local DB to apply**

Run: `npx supabase db reset`
Expected: no SQL errors.

- [ ] **Step 4: Write the failing test**

Create `supabase/tests/orders.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createDbClient } from "./db"
import type { Client } from "pg"

let db: Client

beforeAll(async () => {
  db = createDbClient()
  await db.connect()
})

afterAll(async () => {
  await db.end()
})

describe("orders migration", () => {
  it("creates the order_status enum with the full lifecycle", async () => {
    const res = await db.query(
      `select enumlabel from pg_enum e join pg_type t on e.enumtypid = t.oid where t.typname = 'order_status' order by enumsortorder`
    )
    expect(res.rows.map((r) => r.enumlabel)).toEqual([
      "pending_payment",
      "paid",
      "preparing",
      "ready",
      "completed",
      "cancelled",
    ])
  })

  it("adds the deferred FK from inventory_logs.reference_order_id to orders.id", async () => {
    const res = await db.query(
      `select count(*)::int as count from information_schema.table_constraints
       where table_name = 'inventory_logs' and constraint_name = 'inventory_logs_reference_order_id_fkey'`
    )
    expect(res.rows[0].count).toBe(1)
  })

  it("creates an order with items", async () => {
    const category = await db.query(`insert into public.categories (name) values ('Coffee') returning id`)
    const item = await db.query(
      `insert into public.menu_items (category_id, name, base_price) values ($1, 'Latte', 45000) returning id`,
      [category.rows[0].id]
    )
    const order = await db.query(
      `insert into public.orders (order_type, payment_method, subtotal, total) values ('pickup', 'cash', 45000, 45000) returning id`
    )
    await db.query(
      `insert into public.order_items (order_id, menu_item_id, quantity, unit_price, subtotal) values ($1, $2, 1, 45000, 45000)`,
      [order.rows[0].id, item.rows[0].id]
    )
    const items = await db.query(`select * from public.order_items where order_id = $1`, [order.rows[0].id])
    expect(items.rows).toHaveLength(1)
  })
})
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run supabase/tests/orders.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add supabase
git commit -m "feat(db): add tables/orders/order_items schema with RLS, backfill inventory_logs FK"
```

---

### Task 8: DB schema — Payments & Loyalty

**Files:**
- Create: `supabase/migrations/<timestamp>_payments_and_loyalty.sql`
- Create: `supabase/tests/payments_loyalty.test.ts`

**Interfaces:**
- Produces: `public.payment_transactions`, `public.loyalty_transactions` — consumed by the `handle_order_paid()` trigger in Task 9 (which inserts `loyalty_transactions` rows and reads `loyalty_settings`).

- [ ] **Step 1: Generate the migration**

```bash
npx supabase migration new payments_and_loyalty
```

- [ ] **Step 2: Write the migration**

```sql
create type payment_provider as enum ('stripe', 'vnpay', 'cash');
create type transaction_status as enum ('pending', 'succeeded', 'failed');

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider payment_provider not null,
  provider_transaction_id text,
  amount integer not null,
  status transaction_status not null default 'pending',
  raw_response jsonb,
  created_at timestamptz not null default now()
);
alter table public.payment_transactions enable row level security;

create type loyalty_transaction_type as enum ('earn', 'redeem', 'adjust');

create table public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id),
  order_id uuid references public.orders(id),
  points_change integer not null,
  type loyalty_transaction_type not null,
  created_at timestamptz not null default now()
);
alter table public.loyalty_transactions enable row level security;

create policy "payment_transactions_select_staff" on public.payment_transactions for select
  using (public.current_user_role() in ('staff', 'manager', 'admin'));
create policy "payment_transactions_admin_all" on public.payment_transactions for all
  using (public.current_user_role() in ('manager', 'admin'))
  with check (public.current_user_role() in ('manager', 'admin'));

create policy "loyalty_transactions_select_own" on public.loyalty_transactions for select
  using (customer_id = auth.uid());
create policy "loyalty_transactions_select_staff" on public.loyalty_transactions for select
  using (public.current_user_role() in ('staff', 'manager', 'admin'));
create policy "loyalty_transactions_admin_all" on public.loyalty_transactions for all
  using (public.current_user_role() in ('manager', 'admin'))
  with check (public.current_user_role() in ('manager', 'admin'));
```

- [ ] **Step 3: Reset local DB to apply**

Run: `npx supabase db reset`
Expected: no SQL errors.

- [ ] **Step 4: Write the failing test**

Create `supabase/tests/payments_loyalty.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createDbClient } from "./db"
import type { Client } from "pg"

let db: Client

beforeAll(async () => {
  db = createDbClient()
  await db.connect()
})

afterAll(async () => {
  await db.end()
})

describe("payments_and_loyalty migration", () => {
  it("creates payment_transactions and loyalty_transactions tables", async () => {
    const res = await db.query(
      `select table_name from information_schema.tables where table_schema = 'public'
       and table_name in ('payment_transactions', 'loyalty_transactions')`
    )
    expect(res.rows.map((r) => r.table_name).sort()).toEqual(["loyalty_transactions", "payment_transactions"])
  })

  it("records a payment transaction tied to an order", async () => {
    const order = await db.query(
      `insert into public.orders (order_type, payment_method, subtotal, total) values ('pickup', 'cash', 45000, 45000) returning id`
    )
    await db.query(
      `insert into public.payment_transactions (order_id, provider, amount, status) values ($1, 'cash', 45000, 'succeeded')`,
      [order.rows[0].id]
    )
    const tx = await db.query(`select * from public.payment_transactions where order_id = $1`, [order.rows[0].id])
    expect(tx.rows).toHaveLength(1)
  })
})
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run supabase/tests/payments_loyalty.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add supabase
git commit -m "feat(db): add payment_transactions and loyalty_transactions schema with RLS"
```

---

### Task 9: DB trigger — handle_order_paid()

**Files:**
- Create: `supabase/migrations/<timestamp>_handle_order_paid.sql`
- Create: `supabase/tests/handle_order_paid.test.ts`

**Interfaces:**
- Produces: `public.handle_order_paid()` trigger function + `on_order_paid` BEFORE UPDATE trigger on `public.orders`. Fires whenever `payment_status` transitions to `paid` (from any payment path: Edge Function webhook update or a staff manual cash update) — deducts ingredient stock per the order's BOM, writes `inventory_logs`, computes and writes `loyalty_transactions` (`earn`), updates `profiles.loyalty_points_balance` and `orders.loyalty_points_earned`.

- [ ] **Step 1: Generate the migration**

```bash
npx supabase migration new handle_order_paid
```

- [ ] **Step 2: Write the migration**

```sql
create or replace function public.handle_order_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  earn_rate integer;
  points integer;
  oi record;
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    for oi in
      select id as order_item_id, menu_item_id, quantity
      from public.order_items
      where order_id = new.id
    loop
      update public.ingredients ing
      set stock_quantity = stock_quantity - (mii.quantity_used * oi.quantity)
      from public.menu_item_ingredients mii
      where mii.ingredient_id = ing.id and mii.menu_item_id = oi.menu_item_id;

      insert into public.inventory_logs (ingredient_id, change_quantity, reason, reference_order_id)
      select mii.ingredient_id, -(mii.quantity_used * oi.quantity), 'order_deduction', new.id
      from public.menu_item_ingredients mii
      where mii.menu_item_id = oi.menu_item_id;

      update public.ingredients ing
      set stock_quantity = stock_quantity - (mi.quantity_used * oi.quantity)
      from public.order_item_modifiers oim
      join public.modifier_ingredients mi on mi.modifier_id = oim.modifier_id
      where oim.order_item_id = oi.order_item_id and mi.ingredient_id = ing.id;

      insert into public.inventory_logs (ingredient_id, change_quantity, reason, reference_order_id)
      select mi.ingredient_id, -(mi.quantity_used * oi.quantity), 'order_deduction', new.id
      from public.order_item_modifiers oim
      join public.modifier_ingredients mi on mi.modifier_id = oim.modifier_id
      where oim.order_item_id = oi.order_item_id;
    end loop;

    select earn_rate_vnd_per_point into earn_rate from public.loyalty_settings where id = 1;
    new.loyalty_points_earned := 0;
    if new.customer_id is not null and earn_rate > 0 then
      points := floor(new.total / earn_rate);
      if points > 0 then
        insert into public.loyalty_transactions (customer_id, order_id, points_change, type)
        values (new.customer_id, new.id, points, 'earn');

        update public.profiles
        set loyalty_points_balance = loyalty_points_balance + points
        where id = new.customer_id;

        new.loyalty_points_earned := points;
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger on_order_paid
  before update on public.orders
  for each row
  execute function public.handle_order_paid();
```

- [ ] **Step 3: Reset local DB to apply**

Run: `npx supabase db reset`
Expected: no SQL errors.

- [ ] **Step 4: Write the failing test**

Create `supabase/tests/handle_order_paid.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createDbClient } from "./db"
import type { Client } from "pg"

let db: Client

beforeAll(async () => {
  db = createDbClient()
  await db.connect()
})

afterAll(async () => {
  await db.end()
})

describe("handle_order_paid trigger", () => {
  it("deducts ingredient stock, logs it, and earns loyalty points when an order is marked paid", async () => {
    const category = await db.query(`insert into public.categories (name) values ('Coffee') returning id`)
    const ingredient = await db.query(
      `insert into public.ingredients (name, unit, stock_quantity, low_stock_threshold) values ('Milk', 'ml', 1000, 200) returning id`
    )
    const item = await db.query(
      `insert into public.menu_items (category_id, name, base_price) values ($1, 'Latte', 45000) returning id`,
      [category.rows[0].id]
    )
    await db.query(
      `insert into public.menu_item_ingredients (menu_item_id, ingredient_id, quantity_used) values ($1, $2, 200)`,
      [item.rows[0].id, ingredient.rows[0].id]
    )
    const user = await db.query(
      `insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
       values (gen_random_uuid(), $1, 'x', now(), '{}', '{}') returning id`,
      [`trigger-test-${Date.now()}@example.com`]
    )
    const customerId = user.rows[0].id

    const order = await db.query(
      `insert into public.orders (customer_id, order_type, payment_method, subtotal, total)
       values ($1, 'pickup', 'cash', 45000, 45000) returning id`,
      [customerId]
    )
    const orderId = order.rows[0].id
    await db.query(
      `insert into public.order_items (order_id, menu_item_id, quantity, unit_price, subtotal) values ($1, $2, 1, 45000, 45000)`,
      [orderId, item.rows[0].id]
    )

    await db.query(`update public.orders set payment_status = 'paid' where id = $1`, [orderId])

    const stock = await db.query(`select stock_quantity from public.ingredients where id = $1`, [ingredient.rows[0].id])
    expect(Number(stock.rows[0].stock_quantity)).toBe(800)

    const log = await db.query(`select * from public.inventory_logs where reference_order_id = $1`, [orderId])
    expect(log.rows).toHaveLength(1)
    expect(log.rows[0].reason).toBe("order_deduction")

    const loyalty = await db.query(`select * from public.loyalty_transactions where order_id = $1`, [orderId])
    expect(loyalty.rows).toHaveLength(1)
    expect(loyalty.rows[0].type).toBe("earn")
    expect(loyalty.rows[0].points_change).toBe(4)

    const balance = await db.query(`select loyalty_points_balance from public.profiles where id = $1`, [customerId])
    expect(balance.rows[0].loyalty_points_balance).toBe(4)

    const orderRow = await db.query(`select loyalty_points_earned from public.orders where id = $1`, [orderId])
    expect(orderRow.rows[0].loyalty_points_earned).toBe(4)
  })
})
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run supabase/tests/handle_order_paid.test.ts`
Expected: PASS (4 = floor(45000 / 10000))

- [ ] **Step 6: Commit**

```bash
git add supabase
git commit -m "feat(db): add handle_order_paid trigger for inventory deduction and loyalty earn"
```

---

### Task 10: RLS cross-role behavior verification

**Files:**
- Create: `supabase/tests/rls.test.ts`

**Interfaces:**
- Consumes: all tables/policies from Tasks 3–8; `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` env vars (from `.env.local`, populated in Task 3 Step 3).

- [ ] **Step 1: Write the test**

Create `supabase/tests/rls.test.ts`:
```ts
import { describe, it, expect, beforeAll } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321"
const anonKey = process.env.SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(url, serviceKey)

async function createTestUser(role: "customer" | "staff" | "manager") {
  const email = `rls-${role}-${Date.now()}@example.com`
  const password = "password123!"
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  await admin.from("profiles").update({ role }).eq("id", data.user.id)

  const client = createClient(url, anonKey)
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError
  return { client, userId: data.user.id }
}

describe("RLS cross-role behavior", () => {
  let customer: SupabaseClient
  let staff: SupabaseClient
  let manager: SupabaseClient
  let customerId: string

  beforeAll(async () => {
    const c = await createTestUser("customer")
    customer = c.client
    customerId = c.userId
    staff = (await createTestUser("staff")).client
    manager = (await createTestUser("manager")).client
  })

  it("lets an anonymous visitor read menu categories", async () => {
    const anon = createClient(url, anonKey)
    const { error } = await anon.from("categories").select("*")
    expect(error).toBeNull()
  })

  it("blocks a customer from inserting a category", async () => {
    const { error } = await customer.from("categories").insert({ name: "Hacked" })
    expect(error).not.toBeNull()
  })

  it("lets a manager insert a category", async () => {
    const { error } = await manager.from("categories").insert({ name: "Seasonal" })
    expect(error).toBeNull()
  })

  it("lets a customer see only their own orders", async () => {
    await admin.from("orders").insert([
      { customer_id: customerId, order_type: "pickup", payment_method: "cash", subtotal: 50000, total: 50000 },
    ])
    const { data, error } = await customer.from("orders").select("*")
    expect(error).toBeNull()
    expect(data!.every((o) => o.customer_id === customerId)).toBe(true)
  })

  it("lets staff see all orders, not just their own", async () => {
    const { data, error } = await staff.from("orders").select("*")
    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThan(0)
  })

  it("blocks a customer from updating shop_settings", async () => {
    const { error } = await customer.from("shop_settings").update({ shop_name: "Hacked Cafe" }).eq("id", 1)
    expect(error).not.toBeNull()
  })

  it("blocks a customer from changing their own role", async () => {
    const { error } = await customer.from("profiles").update({ role: "admin" }).eq("id", customerId)
    expect(error).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run it**

Run: `npx vitest run supabase/tests/rls.test.ts`
Expected: PASS — all 7 assertions confirm the access matrix from the spec's Section 3a.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/rls.test.ts
git commit -m "test(db): add cross-role RLS behavior verification suite"
```

---

### Task 11: Edge Function scaffolds

**Files:**
- Create: `supabase/functions/place-order/handler.ts`, `supabase/functions/place-order/handler.test.ts`, `supabase/functions/place-order/index.ts`
- Create: `supabase/functions/stripe-webhook/handler.ts`, `supabase/functions/stripe-webhook/handler.test.ts`, `supabase/functions/stripe-webhook/index.ts`
- Create: `supabase/functions/vnpay-ipn/handler.ts`, `supabase/functions/vnpay-ipn/handler.test.ts`, `supabase/functions/vnpay-ipn/index.ts`
- Create: `supabase/functions/vnpay-return/handler.ts`, `supabase/functions/vnpay-return/handler.test.ts`, `supabase/functions/vnpay-return/index.ts`

**Interfaces:**
- Produces: each function exports `handleRequest(req: Request): Promise<Response>` from `handler.ts` (pure, runtime-agnostic — testable with Vitest since `Request`/`Response` are standard Web APIs). `index.ts` is the thin Deno entrypoint (`Deno.serve(handleRequest)`), not unit tested — it is only exercised via `supabase functions serve` at deploy/run time. Business logic (Stripe/VNPay/order creation) is deferred; each handler currently validates the request shape and returns HTTP 501 with a structured body.

This pattern repeats identically for all four functions except the function name in the response message — write all four.

- [ ] **Step 1: Write the failing test for `place-order`**

Create `supabase/functions/place-order/handler.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { handleRequest } from "./handler"

describe("place-order handler", () => {
  it("responds to CORS preflight", async () => {
    const req = new Request("http://localhost/place-order", { method: "OPTIONS" })
    const res = await handleRequest(req)
    expect(res.status).toBe(204)
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*")
  })

  it("rejects non-POST methods", async () => {
    const req = new Request("http://localhost/place-order", { method: "GET" })
    const res = await handleRequest(req)
    expect(res.status).toBe(405)
  })

  it("returns 501 not_implemented for a valid POST", async () => {
    const req = new Request("http://localhost/place-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [] }),
    })
    const res = await handleRequest(req)
    expect(res.status).toBe(501)
    const body = await res.json()
    expect(body.error).toBe("not_implemented")
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run supabase/functions/place-order/handler.test.ts`
Expected: FAIL — `Cannot find module './handler'`

- [ ] **Step 3: Implement the handler**

Create `supabase/functions/place-order/handler.ts`:
```ts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  await req.json().catch(() => ({}))

  return new Response(
    JSON.stringify({
      error: "not_implemented",
      message: "place-order business logic is not yet implemented",
    }),
    { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  )
}
```

Create `supabase/functions/place-order/index.ts`:
```ts
import { handleRequest } from "./handler.ts"

Deno.serve(handleRequest)
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run supabase/functions/place-order/handler.test.ts`
Expected: PASS

- [ ] **Step 5: Repeat Steps 1–4 for `stripe-webhook`**

Create `supabase/functions/stripe-webhook/handler.test.ts` (identical to place-order's test, with path `/stripe-webhook`).

Create `supabase/functions/stripe-webhook/handler.ts` (identical to place-order's `handler.ts`, with the message changed to `"stripe-webhook business logic is not yet implemented"`).

Create `supabase/functions/stripe-webhook/index.ts` (identical to place-order's `index.ts`).

Run: `npx vitest run supabase/functions/stripe-webhook/handler.test.ts` — Expected: PASS

- [ ] **Step 6: Repeat Steps 1–4 for `vnpay-ipn`**

Same pattern, path `/vnpay-ipn`, message `"vnpay-ipn business logic is not yet implemented"`.

Run: `npx vitest run supabase/functions/vnpay-ipn/handler.test.ts` — Expected: PASS

- [ ] **Step 7: Repeat Steps 1–4 for `vnpay-return`**

Same pattern, path `/vnpay-return`, message `"vnpay-return business logic is not yet implemented"`.

Run: `npx vitest run supabase/functions/vnpay-return/handler.test.ts` — Expected: PASS

- [ ] **Step 8: Run the full Edge Function test suite together**

Run: `npx vitest run supabase/functions`
Expected: 4 test files, 12 tests, all PASS

- [ ] **Step 9: Commit**

```bash
git add supabase/functions
git commit -m "feat: scaffold place-order, stripe-webhook, vnpay-ipn, vnpay-return edge functions"
```

---

### Task 12: Next.js middleware — role-based route protection

**Files:**
- Create: `middleware.ts`
- Create: `middleware.test.ts`

**Interfaces:**
- Produces: `resolveRedirect(pathname: string, role: string | null): string | null` — pure function consumed by the exported `middleware()` Next.js entrypoint and directly by the unit test. Also produces `ROUTE_GROUP_ROLES` and `ROLE_HOME` used by Task 13's page links.
- Consumes: `lib/supabase/server.ts`'s client pattern is not reusable as-is inside middleware (different cookie API) — middleware builds its own `createServerClient` call inline per the `@supabase/ssr` middleware pattern.

- [ ] **Step 1: Write the failing test for the pure redirect logic**

Create `middleware.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { resolveRedirect } from "./middleware"

describe("resolveRedirect", () => {
  it("allows staff into /staff/pos", () => {
    expect(resolveRedirect("/staff/pos", "staff")).toBeNull()
  })

  it("allows manager into /staff/pos too", () => {
    expect(resolveRedirect("/staff/pos", "manager")).toBeNull()
  })

  it("blocks a customer from /staff/pos, sends them to /menu", () => {
    expect(resolveRedirect("/staff/pos", "customer")).toBe("/menu")
  })

  it("blocks anonymous visitors from /admin/dashboard, sends them to /login", () => {
    expect(resolveRedirect("/admin/dashboard", null)).toBe("/login")
  })

  it("allows admin into /admin/dashboard", () => {
    expect(resolveRedirect("/admin/dashboard", "admin")).toBeNull()
  })

  it("blocks staff (not manager/admin) from /admin/inventory", () => {
    expect(resolveRedirect("/admin/inventory", "staff")).toBe("/staff/pos")
  })

  it("blocks a manager from the admin-only /admin/staff page", () => {
    expect(resolveRedirect("/admin/staff", "manager")).toBe("/admin/dashboard")
  })

  it("blocks a manager from the admin-only /admin/settings page", () => {
    expect(resolveRedirect("/admin/settings", "manager")).toBe("/admin/dashboard")
  })

  it("allows admin into /admin/staff", () => {
    expect(resolveRedirect("/admin/staff", "admin")).toBeNull()
  })

  it("does not redirect public/customer routes", () => {
    expect(resolveRedirect("/menu", null)).toBeNull()
    expect(resolveRedirect("/", null)).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run middleware.test.ts`
Expected: FAIL — `Cannot find module './middleware'`

- [ ] **Step 3: Implement middleware.ts**

Create `middleware.ts`:
```ts
import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

export const ROLE_HOME: Record<string, string> = {
  customer: "/menu",
  staff: "/staff/pos",
  manager: "/admin/dashboard",
  admin: "/admin/dashboard",
}

const ADMIN_ONLY_PREFIXES = ["/admin/staff", "/admin/settings"]

const ROUTE_GROUP_ROLES: { prefix: string; roles: string[] }[] = [
  { prefix: "/staff", roles: ["staff", "manager", "admin"] },
  { prefix: "/admin", roles: ["manager", "admin"] },
]

export function resolveRedirect(pathname: string, role: string | null): string | null {
  const adminOnlyMatch = ADMIN_ONLY_PREFIXES.find((p) => pathname.startsWith(p))
  if (adminOnlyMatch) {
    if (role !== "admin") {
      return role ? (ROLE_HOME[role] ?? "/menu") : "/login"
    }
    return null
  }

  const match = ROUTE_GROUP_ROLES.find((r) => pathname.startsWith(r.prefix))
  if (!match) return null

  if (!role || !match.roles.includes(role)) {
    return role ? (ROLE_HOME[role] ?? "/menu") : "/login"
  }
  return null
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let role: string | null = null
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    role = profile?.role ?? null
  }

  const redirectPath = resolveRedirect(request.nextUrl.pathname, role)
  if (redirectPath) {
    return NextResponse.redirect(new URL(redirectPath, request.url))
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run middleware.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add middleware.ts middleware.test.ts
git commit -m "feat: add role-based route protection middleware"
```

---

### Task 13: Route scaffolding — placeholder pages for all route groups

**Files:**
- Create: `app/(marketing)/layout.tsx`, `app/(marketing)/page.tsx`
- Create: `app/(auth)/layout.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`
- Create: `app/(customer)/layout.tsx`, `app/(customer)/menu/page.tsx`, `app/(customer)/cart/page.tsx`, `app/(customer)/checkout/page.tsx`, `app/(customer)/orders/page.tsx`, `app/(customer)/orders/[orderId]/page.tsx`, `app/(customer)/table/[qrToken]/page.tsx`, `app/(customer)/profile/page.tsx`, `app/(customer)/loyalty/page.tsx`
- Create: `app/staff/layout.tsx`, `app/staff/pos/page.tsx`, `app/staff/orders/page.tsx`
- Create: `app/admin/layout.tsx`, `app/admin/dashboard/page.tsx`, `app/admin/menu/page.tsx`, `app/admin/inventory/page.tsx`, `app/admin/tables/page.tsx`, `app/admin/staff/page.tsx`, `app/admin/settings/page.tsx`
- Modify: `app/page.tsx` — delete (superseded by `app/(marketing)/page.tsx`)
- Create: `app/(marketing)/page.test.tsx`, `app/(customer)/menu/page.test.tsx`, `app/staff/pos/page.test.tsx`, `app/admin/dashboard/page.test.tsx` (representative render tests — one per route group, not all 20 pages)

**Interfaces:**
- Produces: every route from the corrected structure in Global Constraints, each rendering only a heading naming the page (no feature UI — that is a later phase). Each `layout.tsx` renders `{children}` plus a heading naming its section, so nested pages are visually traceable during manual verification.

- [ ] **Step 1: Remove the temporary home page from Task 1**

```bash
rm app/page.tsx
```

- [ ] **Step 2: Scaffold the (marketing) group**

Create `app/(marketing)/layout.tsx`:
```tsx
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header className="p-4 border-b">Coffee Shop</header>
      {children}
    </div>
  )
}
```

Create `app/(marketing)/page.tsx`:
```tsx
export default function LandingPage() {
  return <main className="p-8"><h1>Welcome to the Coffee Shop</h1></main>
}
```

Create `app/(marketing)/page.test.tsx`:
```tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import LandingPage from "./page"

describe("Landing page", () => {
  it("renders a welcome heading", () => {
    render(<LandingPage />)
    expect(screen.getByRole("heading", { name: /welcome to the coffee shop/i })).toBeInTheDocument()
  })
})
```

Run: `npx vitest run "app/(marketing)/page.test.tsx"`
Expected: PASS

- [ ] **Step 3: Scaffold the (auth) group**

Create `app/(auth)/layout.tsx`:
```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center">{children}</div>
}
```

Create `app/(auth)/login/page.tsx`:
```tsx
export default function LoginPage() {
  return <main><h1>Log In</h1></main>
}
```

Create `app/(auth)/signup/page.tsx`:
```tsx
export default function SignupPage() {
  return <main><h1>Sign Up</h1></main>
}
```

- [ ] **Step 4: Scaffold the (customer) group**

Create `app/(customer)/layout.tsx`:
```tsx
export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="p-4 border-b flex gap-4">
        <span>Menu</span>
        <span>Cart</span>
        <span>Orders</span>
        <span>Profile</span>
        <span>Loyalty</span>
      </nav>
      {children}
    </div>
  )
}
```

Create `app/(customer)/menu/page.tsx`:
```tsx
export default function MenuPage() {
  return <main className="p-8"><h1>Menu</h1></main>
}
```

Create `app/(customer)/menu/page.test.tsx`:
```tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import MenuPage from "./page"

describe("Customer menu page", () => {
  it("renders a Menu heading", () => {
    render(<MenuPage />)
    expect(screen.getByRole("heading", { name: /menu/i })).toBeInTheDocument()
  })
})
```

Run: `npx vitest run "app/(customer)/menu/page.test.tsx"`
Expected: PASS

Create `app/(customer)/cart/page.tsx`:
```tsx
export default function CartPage() {
  return <main className="p-8"><h1>Cart</h1></main>
}
```

Create `app/(customer)/checkout/page.tsx`:
```tsx
export default function CheckoutPage() {
  return <main className="p-8"><h1>Checkout</h1></main>
}
```

Create `app/(customer)/orders/page.tsx`:
```tsx
export default function OrderHistoryPage() {
  return <main className="p-8"><h1>Order History</h1></main>
}
```

Create `app/(customer)/orders/[orderId]/page.tsx`:
```tsx
export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  return (
    <main className="p-8">
      <h1>Order Tracking</h1>
      <p>Order ID: {orderId}</p>
    </main>
  )
}
```

Create `app/(customer)/table/[qrToken]/page.tsx`:
```tsx
export default async function TableOrderPage({
  params,
}: {
  params: Promise<{ qrToken: string }>
}) {
  const { qrToken } = await params
  return (
    <main className="p-8">
      <h1>Dine-in Order</h1>
      <p>Table token: {qrToken}</p>
    </main>
  )
}
```

Create `app/(customer)/profile/page.tsx`:
```tsx
export default function ProfilePage() {
  return <main className="p-8"><h1>Profile</h1></main>
}
```

Create `app/(customer)/loyalty/page.tsx`:
```tsx
export default function LoyaltyPage() {
  return <main className="p-8"><h1>Loyalty Points</h1></main>
}
```

- [ ] **Step 5: Scaffold the staff area (`/staff/*`)**

Create `app/staff/layout.tsx`:
```tsx
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="p-4 border-b flex gap-4">
        <span>POS</span>
        <span>Kitchen Display</span>
      </nav>
      {children}
    </div>
  )
}
```

Create `app/staff/pos/page.tsx`:
```tsx
export default function PosPage() {
  return <main className="p-8"><h1>POS</h1></main>
}
```

Create `app/staff/pos/page.test.tsx`:
```tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import PosPage from "./page"

describe("POS page", () => {
  it("renders a POS heading", () => {
    render(<PosPage />)
    expect(screen.getByRole("heading", { name: /pos/i })).toBeInTheDocument()
  })
})
```

Run: `npx vitest run app/staff/pos/page.test.tsx`
Expected: PASS

Create `app/staff/orders/page.tsx`:
```tsx
export default function KitchenDisplayPage() {
  return <main className="p-8"><h1>Kitchen Display</h1></main>
}
```

- [ ] **Step 6: Scaffold the admin area (`/admin/*`)**

Create `app/admin/layout.tsx`:
```tsx
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="p-4 border-b flex gap-4">
        <span>Dashboard</span>
        <span>Menu</span>
        <span>Inventory</span>
        <span>Tables</span>
        <span>Staff</span>
        <span>Settings</span>
      </nav>
      {children}
    </div>
  )
}
```

Create `app/admin/dashboard/page.tsx`:
```tsx
export default function DashboardPage() {
  return <main className="p-8"><h1>Dashboard</h1></main>
}
```

Create `app/admin/dashboard/page.test.tsx`:
```tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import DashboardPage from "./page"

describe("Admin dashboard page", () => {
  it("renders a Dashboard heading", () => {
    render(<DashboardPage />)
    expect(screen.getByRole("heading", { name: /dashboard/i })).toBeInTheDocument()
  })
})
```

Run: `npx vitest run app/admin/dashboard/page.test.tsx`
Expected: PASS

Create `app/admin/menu/page.tsx`:
```tsx
export default function AdminMenuPage() {
  return <main className="p-8"><h1>Manage Menu</h1></main>
}
```

Create `app/admin/inventory/page.tsx`:
```tsx
export default function InventoryPage() {
  return <main className="p-8"><h1>Inventory</h1></main>
}
```

Create `app/admin/tables/page.tsx`:
```tsx
export default function TablesPage() {
  return <main className="p-8"><h1>Tables</h1></main>
}
```

Create `app/admin/staff/page.tsx`:
```tsx
export default function StaffAccountsPage() {
  return <main className="p-8"><h1>Staff Accounts</h1></main>
}
```

Create `app/admin/settings/page.tsx`:
```tsx
export default function SettingsPage() {
  return <main className="p-8"><h1>Settings</h1></main>
}
```

- [ ] **Step 7: Verify the whole app builds and all route tests pass**

Run: `npm run build`
Expected: build succeeds with 20 routes listed in the output (no duplicate-route errors — confirms the collision fix from Global Constraints worked).

Run: `npm test`
Expected: all test files PASS (frontend component tests; DB/RLS/edge function tests from earlier tasks require `npx supabase start` to already be running).

- [ ] **Step 8: Manually verify routing in the dev server**

Run: `npm run dev`, then visit `/`, `/login`, `/signup`, `/menu`, `/cart`, `/checkout`, `/orders`, `/orders/abc123`, `/table/xyz`, `/profile`, `/loyalty`, `/staff/pos`, `/staff/orders`, `/admin/dashboard`, `/admin/menu`, `/admin/inventory`, `/admin/tables`, `/admin/staff`, `/admin/settings`.
Expected: every route renders its heading with no errors (middleware from Task 12 will redirect `/staff/*` and `/admin/*` since there's no signed-in session yet — that's correct behavior; note it and move on).

- [ ] **Step 9: Commit**

```bash
git add app
git commit -m "feat: scaffold placeholder pages for all route groups"
```

---

### Task 14: Root docs — CLAUDE.md, continuity.md, daily.md

**Files:**
- Create: `CLAUDE.md`
- Create: `continuity.md`
- Create: `daily.md`

**Interfaces:**
- None (documentation only).

- [ ] **Step 1: Write CLAUDE.md**

Create `CLAUDE.md`:
```markdown
# CLAUDE.md

Structural map of the Coffee Shop app. Full rationale lives in
`docs/superpowers/specs/2026-07-04-coffee-shop-app-design.md`.

## Stack

Next.js (App Router, TypeScript) + Tailwind + shadcn/ui, talking directly to
Supabase (Postgres + Auth + Realtime) via its SDK. No custom backend server —
Row Level Security (RLS) is the real access-control boundary. Edge Functions
handle logic needing secrets or atomicity (payments, order placement).

## Roles

`profiles.role`: `customer | staff | manager | admin`. Staff = fulfillment
(POS + Kitchen Display). Manager = Staff + menu/inventory/tables/reports.
Admin = Manager + staff accounts/roles + shop/loyalty settings.

## Route map

- `app/(marketing)` — public landing page (`/`)
- `app/(auth)` — `/login`, `/signup`
- `app/(customer)` — `/menu`, `/cart`, `/checkout`, `/orders`, `/orders/[orderId]`,
  `/table/[qrToken]`, `/profile`, `/loyalty` (no forced auth yet — deferred)
- `app/staff` — `/staff/pos`, `/staff/orders` (real folder, not a route group,
  to avoid colliding with `(customer)`'s bare paths)
- `app/admin` — `/admin/dashboard`, `/admin/menu`, `/admin/inventory`,
  `/admin/tables`, `/admin/staff` (admin-only), `/admin/settings` (admin-only)

`middleware.ts` gates `/staff/*` (staff|manager|admin) and `/admin/*`
(manager|admin, with `/admin/staff` and `/admin/settings` further restricted
to admin) via `resolveRedirect()`. This is the UX gate; RLS is the actual
security boundary.

## Database (`supabase/migrations/`)

Applied in order: identity_and_roles → shop_config → menu → inventory →
orders → payments_and_loyalty → handle_order_paid. See the spec's Section 2
for the full entity list and Section 3 for the RLS access matrix.

Key mechanism: `handle_order_paid()` is a single BEFORE UPDATE trigger on
`orders` that fires whenever `payment_status` transitions to `paid`,
regardless of which payment path (Stripe webhook, VNPay IPN, or a staff cash
update) caused it — it deducts ingredient stock and earns loyalty points in
one place instead of three.

## Edge Functions (`supabase/functions/`)

`place-order`, `stripe-webhook`, `vnpay-ipn`, `vnpay-return`. Each exports a
pure `handleRequest(req: Request): Promise<Response>` from `handler.ts`
(unit-testable with Vitest) plus a thin `index.ts` Deno entrypoint. Business
logic is not yet implemented — each currently returns HTTP 501.

## Testing

`npm test` runs Vitest across frontend component tests, middleware logic,
edge function handlers, and DB/RLS integration tests. The DB/RLS tests
require local Supabase running first: `npm run db:start` (needs Docker
Desktop), then `npm run db:reset` after any migration change.

## Known deviations from the original spec doc

Route groups (`(name)`) are invisible in the URL, so `staff` and `admin` are
real folders (not route groups) to prevent them from colliding with
`(customer)`'s bare paths (`/menu`, `/orders`). The spec's separate
`(public)` menu-browse page was folded into the single `(customer)/menu`
page — there is one menu page, viewable by anyone regardless of auth state.
```

- [ ] **Step 2: Write continuity.md**

Create `continuity.md`:
```markdown
# Project: Coffee Shop Management & Customer Portal

## Goal

Web app for a single-location coffee shop: customer ordering (pickup +
dine-in QR), staff POS + Kitchen Display, manager/admin menu/inventory/
reporting/settings. Full spec: `docs/superpowers/specs/2026-07-04-coffee-shop-app-design.md`.

## Current status

Structural scaffold complete: Next.js app, full Supabase schema + RLS +
`handle_order_paid()` trigger, four stubbed Edge Functions, role-based
middleware, placeholder pages for every route. No business logic or visual
design yet.

## Completed

- Next.js + Tailwind + shadcn/ui scaffold
- Supabase client helpers (`lib/supabase/client.ts`, `server.ts`) + Vitest/RTL setup
- Full DB schema (identity/roles, shop config, menu, inventory, orders, payments/loyalty)
  with RLS on every table, verified by migration-level and cross-role RLS tests
- `handle_order_paid()` trigger (inventory deduction + loyalty earn), verified by test
- Edge Function scaffolds (place-order, stripe-webhook, vnpay-ipn, vnpay-return) —
  return HTTP 501, business logic not yet implemented
- Role-based route middleware (`/staff/*`, `/admin/*`), verified by unit test
- Placeholder pages for all 20 routes across (marketing)/(auth)/(customer)/staff/admin

## Key decisions

- Supabase-only backend (no custom Express/API server) — RLS is the real security boundary
- Single location, no branches table
- Loyalty: admin-configurable rates, defaults 10,000 VND spent = 1 point, 100 points = 10,000 VND discount
- Payments: Stripe (card), Cash, VNPay — all sandbox for now
- `staff` and `admin` are real URL-segment folders, not route groups, to avoid
  colliding with `(customer)`'s bare paths — see CLAUDE.md "Known deviations"

## Next steps

- Implement `place-order` Edge Function business logic (server-side pricing,
  stock validation, loyalty redemption, Stripe/VNPay integration)
- Implement Stripe/VNPay webhook verification and payment flows
- Wire real Supabase Realtime subscriptions (order tracking, Kitchen Display, low-stock alerts)
- Build out real feature UI (currently placeholder headings only)
- Per-page auth redirects for customer pages (checkout/profile/orders/loyalty)
- Visual/UI design pass (deferred per the spec)
```

- [ ] **Step 3: Write daily.md**

Create `daily.md`:
```markdown
# Today: Scaffold complete

## Task

Scaffolded the full app structure per
`docs/superpowers/plans/2026-07-04-coffee-shop-scaffold.md`: Next.js project,
Supabase schema/RLS/trigger, Edge Function stubs, middleware, and all
placeholder routes.

## Context

- Spec: `docs/superpowers/specs/2026-07-04-coffee-shop-app-design.md`
- Plan: `docs/superpowers/plans/2026-07-04-coffee-shop-scaffold.md`

## Done when

- `npm run build` succeeds with 20 routes, no duplicate-route errors
- `npm test` passes (frontend + middleware + edge function + DB/RLS suites,
  with local Supabase running for the DB suites)
- `CLAUDE.md`, `continuity.md` reflect the current (scaffold-complete) state
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md continuity.md daily.md
git commit -m "docs: add CLAUDE.md, continuity.md, daily.md tracking files"
```

---

### Task 15: Env config + setup docs

**Files:**
- Create: `.env.local.example`
- Modify: `README.md`

**Interfaces:**
- Documents every env var consumed by `lib/supabase/client.ts`, `lib/supabase/server.ts`, `middleware.ts`, and `supabase/tests/db.ts`/`rls.test.ts`.

- [ ] **Step 1: Write the env template**

Create `.env.local.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
VNPAY_TMN_CODE=
VNPAY_HASH_SECRET=
VNPAY_RETURN_URL=http://localhost:3000/vnpay-return
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 2: Verify env var names match what the code reads**

Run: `grep -rn "process.env\." lib/supabase middleware.ts supabase/tests`
Expected: every `process.env.X` name printed appears in `.env.local.example` above (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_DB_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). If any name differs, fix `.env.local.example` to match the code (the code is the source of truth).

- [ ] **Step 3: Add setup instructions to README.md**

Prepend to `README.md` (above the default Next.js content `create-next-app` generated):
```markdown
## Setup

1. `npm install`
2. Copy `.env.local.example` to `.env.local`.
3. Start local Supabase (requires Docker Desktop running): `npm run db:start`
4. Copy the printed `API URL`, `anon key`, and `service_role key` into `.env.local`
   as `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_ANON_KEY`,
   and `SUPABASE_SERVICE_ROLE_KEY`.
5. Apply migrations: `npm run db:reset`
6. Run the app: `npm run dev`
7. Run tests: `npm test` (Supabase must be running for the `supabase/tests` suite)

---
```

- [ ] **Step 4: Commit**

```bash
git add .env.local.example README.md
git commit -m "docs: add env template and setup instructions"
```
