-- 0034_loyalty_tiers.sql
-- Real Loyalty tier progress, replacing the hardcoded mock in
-- components/customer/loyalty-view.tsx. Tier is based on lifetime points
-- EARNED (sum of positive loyalty_transactions.points_change), not the
-- current spendable profiles.loyalty_points_balance -- redeeming points
-- must never demote a customer's tier.

create table public.loyalty_tiers (
  id uuid primary key default gen_random_uuid(),
  name_vi text not null,
  name_en text not null,
  min_points integer not null unique,
  sort_order integer not null default 0
);
alter table public.loyalty_tiers enable row level security;
create policy "loyalty_tiers_select_all" on public.loyalty_tiers for select using (true);

insert into public.loyalty_tiers (name_vi, name_en, min_points, sort_order) values
  ('Đồng', 'Bronze', 0, 0),
  ('Bạc', 'Silver', 300, 1),
  ('Vàng', 'Gold', 1000, 2),
  ('Kim Cương', 'Diamond', 3000, 3);

create or replace function public.get_my_loyalty_tier_progress()
returns table (
  lifetime_points integer,
  current_tier_name_vi text,
  current_tier_name_en text,
  next_tier_name_vi text,
  next_tier_name_en text,
  points_to_next integer,
  progress_percent integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid := auth.uid();
  v_lifetime integer;
begin
  if v_customer_id is null then
    raise exception 'not_authenticated';
  end if;

  select coalesce(sum(points_change), 0) into v_lifetime
    from public.loyalty_transactions
    where customer_id = v_customer_id and points_change > 0;

  return query
  with current_tier as (
    select t.name_vi, t.name_en, t.min_points
    from public.loyalty_tiers t
    where t.min_points <= v_lifetime
    order by t.min_points desc
    limit 1
  ),
  next_tier as (
    select t.name_vi, t.name_en, t.min_points
    from public.loyalty_tiers t
    where t.min_points > v_lifetime
    order by t.min_points asc
    limit 1
  )
  select
    v_lifetime,
    ct.name_vi,
    ct.name_en,
    nt.name_vi,
    nt.name_en,
    case when nt.min_points is not null then nt.min_points - v_lifetime else null end,
    case when nt.min_points is not null then
      round(100.0 * (v_lifetime - ct.min_points) / nullif(nt.min_points - ct.min_points, 0))::integer
    else 100 end
  from current_tier ct
  left join next_tier nt on true;
end;
$$;

grant execute on function public.get_my_loyalty_tier_progress() to authenticated;
