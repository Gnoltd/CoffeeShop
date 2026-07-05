-- categories, menu_items, menu_item_sizes, modifier_groups, modifiers, menu_item_modifier_groups

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
