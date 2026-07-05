-- ingredients, menu_item_ingredients, modifier_ingredients, inventory_logs

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
