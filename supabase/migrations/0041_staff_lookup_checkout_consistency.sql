-- 0041_staff_lookup_checkout_consistency.sql
-- Migration 0040 added self-service checkout application
-- (reward_redemptions.applied_order_id) as the primary way to use a
-- redemption. The staff lookup/fulfill RPCs from 0038 only knew about
-- fulfilled_at -- a code already spent at checkout would still look
-- "available" to staff and could be double-honored in person. Both RPCs
-- now treat applied_order_id as equally final as fulfilled_at.

-- return shape changed (added applied_order_id) -- create or replace
-- can't change OUT-parameter row types, needs an explicit drop first.
drop function if exists public.find_redemption_by_code(text);

create function public.find_redemption_by_code(p_code text)
returns table (
  id uuid,
  reward_name_vi text,
  reward_name_en text,
  points_spent integer,
  redeemed_at timestamptz,
  fulfilled_at timestamptz,
  applied_order_id uuid,
  customer_name text
)
language plpgsql
security invoker
set search_path = public
as $$
begin
  return query
  select
    rr.id,
    r.name_vi,
    r.name_en,
    rr.points_spent,
    rr.redeemed_at,
    rr.fulfilled_at,
    rr.applied_order_id,
    p.full_name
  from public.reward_redemptions rr
  join public.rewards r on r.id = rr.reward_id
  join public.profiles p on p.id = rr.customer_id
  where rr.id::text ilike (p_code || '%')
  order by rr.redeemed_at desc
  limit 5;
end;
$$;

grant execute on function public.find_redemption_by_code(text) to authenticated;

create or replace function public.fulfill_redemption(p_redemption_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fulfilled_at timestamptz;
  v_applied_order_id uuid;
begin
  if public.current_user_role() not in ('staff', 'manager', 'admin') then
    raise exception 'not_authorized';
  end if;

  select fulfilled_at, applied_order_id into v_fulfilled_at, v_applied_order_id
    from public.reward_redemptions where id = p_redemption_id;
  if v_fulfilled_at is not null or v_applied_order_id is not null then
    raise exception 'already_fulfilled';
  end if;

  update public.reward_redemptions set fulfilled_at = now()
    where id = p_redemption_id and fulfilled_at is null and applied_order_id is null
    returning fulfilled_at into v_fulfilled_at;

  if v_fulfilled_at is null then
    raise exception 'redemption_not_found';
  end if;

  return v_fulfilled_at;
end;
$$;
