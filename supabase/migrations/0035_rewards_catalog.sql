-- 0035_rewards_catalog.sql
-- Real Rewards catalog + redemption, replacing the disabled+tooltip
-- "Redeem Rewards" button on the Loyalty page. redeem_reward() mirrors
-- place_order's existing loyalty-redeem branch (0014_orders_place_and_track_fns.sql)
-- exactly: insert a loyalty_transactions row + decrement
-- profiles.loyalty_points_balance, just with order_id null since this
-- isn't tied to an order.

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  name_vi text not null,
  name_en text not null,
  description_vi text not null default '',
  description_en text not null default '',
  points_cost integer not null check (points_cost > 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.rewards enable row level security;
create policy "rewards_select_all" on public.rewards for select using (true);

create table public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id),
  reward_id uuid not null references public.rewards(id),
  points_spent integer not null,
  redeemed_at timestamptz not null default now()
);
alter table public.reward_redemptions enable row level security;
create policy "reward_redemptions_select_own" on public.reward_redemptions for select
  using (customer_id = auth.uid());
create policy "reward_redemptions_select_staff" on public.reward_redemptions for select
  using (public.current_user_role() in ('staff', 'manager', 'admin'));

insert into public.rewards (name_vi, name_en, description_vi, description_en, points_cost, sort_order) values
  ('Cà Phê Đen Miễn Phí', 'Free Black Coffee', 'Đổi điểm lấy một ly cà phê đen miễn phí.', 'Redeem for one free black coffee.', 50, 0),
  ('Bánh Ngọt Miễn Phí', 'Free Pastry', 'Đổi điểm lấy một phần bánh ngọt miễn phí.', 'Redeem for one free pastry.', 100, 1),
  ('Giảm 20.000₫', '20,000₫ Off', 'Giảm trực tiếp 20.000₫ cho đơn hàng tiếp theo.', '20,000 VND off your next order.', 150, 2),
  ('Nâng Cấp Size Miễn Phí', 'Free Size Upgrade', 'Nâng cấp size đồ uống miễn phí.', 'Free size upgrade on any drink.', 80, 3);

create or replace function public.redeem_reward(p_reward_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid := auth.uid();
  v_points_cost integer;
  v_active boolean;
  v_balance integer;
  v_redemption_id uuid;
begin
  if v_customer_id is null then
    raise exception 'not_authenticated';
  end if;

  select points_cost, active into v_points_cost, v_active
    from public.rewards where id = p_reward_id;

  if v_points_cost is null then
    raise exception 'reward_not_found';
  end if;
  if not v_active then
    raise exception 'reward_inactive';
  end if;

  select loyalty_points_balance into v_balance
    from public.profiles where id = v_customer_id;

  if v_balance < v_points_cost then
    raise exception 'insufficient_points';
  end if;

  insert into public.reward_redemptions (customer_id, reward_id, points_spent)
  values (v_customer_id, p_reward_id, v_points_cost)
  returning id into v_redemption_id;

  insert into public.loyalty_transactions (customer_id, order_id, points_change, type)
  values (v_customer_id, null, -v_points_cost, 'redeem');

  update public.profiles set loyalty_points_balance = loyalty_points_balance - v_points_cost
    where id = v_customer_id;

  return v_redemption_id;
end;
$$;

grant execute on function public.redeem_reward(uuid) to authenticated;
