-- tables, orders, order_items, order_item_modifiers

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
