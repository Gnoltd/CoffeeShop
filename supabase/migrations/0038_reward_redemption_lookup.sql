-- 0038_reward_redemption_lookup.sql
-- Staff-facing redemption lookup + fulfillment. The customer-facing
-- redemption code (rewards-catalog-modal.tsx, first 8 chars of the
-- redemption id, matching formatOrderId's existing convention) had
-- nowhere for staff to check it — this closes the loop: a code lookup
-- RPC plus a fulfilled_at flag so the same code can't be honored twice.

alter table public.reward_redemptions add column fulfilled_at timestamptz;

-- security invoker: reward_redemptions/profiles staff-select RLS already
-- gates this (matches get_shift_report's "RLS is the access gate" pattern).
create or replace function public.find_redemption_by_code(p_code text)
returns table (
  id uuid,
  reward_name_vi text,
  reward_name_en text,
  points_spent integer,
  redeemed_at timestamptz,
  fulfilled_at timestamptz,
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
    p.full_name
  from public.reward_redemptions rr
  join public.rewards r on r.id = rr.reward_id
  join public.profiles p on p.id = rr.customer_id
  where rr.id::text ilike (p_code || '%')
  order by rr.redeemed_at desc
  limit 5;
end;
$$;

-- security definer: reward_redemptions has no UPDATE RLS policy at all
-- (its only write path was previously redeem_reward's internal INSERT).
-- Narrowly scoped to only ever touch fulfilled_at, matching this
-- project's increment_table_scan_count precedent, with its own internal
-- role check since security definer bypasses RLS entirely.
create or replace function public.fulfill_redemption(p_redemption_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fulfilled_at timestamptz;
begin
  if public.current_user_role() not in ('staff', 'manager', 'admin') then
    raise exception 'not_authorized';
  end if;

  select fulfilled_at into v_fulfilled_at from public.reward_redemptions where id = p_redemption_id;
  if v_fulfilled_at is not null then
    raise exception 'already_fulfilled';
  end if;

  update public.reward_redemptions set fulfilled_at = now()
    where id = p_redemption_id and fulfilled_at is null
    returning fulfilled_at into v_fulfilled_at;

  if v_fulfilled_at is null then
    raise exception 'redemption_not_found';
  end if;

  return v_fulfilled_at;
end;
$$;

grant execute on function public.find_redemption_by_code(text) to authenticated;
grant execute on function public.fulfill_redemption(uuid) to authenticated;
