-- shop_settings, loyalty_settings (admin-configurable rates: 10,000 VND = 1 point, 100 points = 10,000 VND)

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
