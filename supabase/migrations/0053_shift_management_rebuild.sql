-- 0053_shift_management_rebuild.sql
-- KDS shift-management rebuild:
--   * staff (not just manager/admin) can open/join/close a shift
--   * a shift now gates order placement entirely — place_order rejects
--     every new order (customer self-checkout AND POS) while no shift
--     is open
--   * opener/closer full name + an optional planned start/end window
--     are tracked, plus a roster of staff who joined the open shift
--   * shift report gains a per-item (product) revenue/quantity
--     breakdown alongside the existing per-method breakdown
--
-- Deliberately NOT done here (keeping the original 0031 design's "one
-- shop, one drawer" simplification): no shift_id FK on orders. A
-- shift's transactions stay a time-window query over orders.paid_at,
-- same as before — only the report/RPCs are extended.

-- ---------------------------------------------------------------------
-- 1. shifts: planned start/end window (distinct from the actual
--    opened_at/closed_at click timestamps).
-- ---------------------------------------------------------------------
alter table public.shifts add column planned_start_at timestamptz;
alter table public.shifts add column planned_end_at timestamptz;

-- ---------------------------------------------------------------------
-- 2. Broaden shifts RLS: staff can now open/join/close/view a shift,
--    not just manager/admin. Staff already has full order read/update
--    access (orders_select_staff/orders_update_staff, migration 0005),
--    so seeing shift revenue is not a new trust boundary.
-- ---------------------------------------------------------------------
drop policy if exists "shifts_manager_admin_all" on public.shifts;

create policy "shifts_staff_all" on public.shifts
  for all
  using (public.current_user_role() in ('staff', 'manager', 'admin'))
  with check (public.current_user_role() in ('staff', 'manager', 'admin'));

-- ---------------------------------------------------------------------
-- 3. shift_workers: roster of staff who joined the open shift (only
--    one person opens it; others explicitly join/leave). Same trust
--    level as `shifts` itself (staff/manager/admin, one shared FOR ALL
--    policy) — close_shift needs to close out every still-open roster
--    row, including ones belonging to staff other than the closer, so
--    this deliberately isn't self-scoped (matches e.g.
--    tables_update_staff: any staff on shift can affect shared state,
--    not just their own row).
-- ---------------------------------------------------------------------
create table public.shift_workers (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  staff_id uuid not null references public.profiles(id),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (shift_id, staff_id)
);

alter table public.shift_workers enable row level security;

create policy "shift_workers_staff_all" on public.shift_workers
  for all
  using (public.current_user_role() in ('staff', 'manager', 'admin'))
  with check (public.current_user_role() in ('staff', 'manager', 'admin'));

-- ---------------------------------------------------------------------
-- 4. get_shift_report: extend with opener/closer name, planned
--    start/end, the worker roster, and a per-item sold breakdown.
-- ---------------------------------------------------------------------
create or replace function public.get_shift_report(p_shift_id uuid default null)
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
  s public.shifts%rowtype;
  v_window_end timestamptz;
  v_by_method json;
  v_cash_total bigint;
  v_expected bigint;
  v_transactions json;
  v_opened_by_name text;
  v_closed_by_name text;
  v_workers json;
  v_items_sold json;
begin
  if p_shift_id is null then
    select * into s from public.shifts where closed_at is null;
  else
    select * into s from public.shifts where id = p_shift_id;
  end if;
  if s.id is null then
    return null;
  end if;

  v_window_end := coalesce(s.closed_at, now());

  select p.full_name into v_opened_by_name from public.profiles p where p.id = s.opened_by;
  select p.full_name into v_closed_by_name from public.profiles p where p.id = s.closed_by;

  select coalesce(json_agg(row_to_json(m)), '[]'::json) into v_by_method
  from (
    select o.payment_method as method, count(*)::int as count, coalesce(sum(o.total), 0)::bigint as total
    from public.orders o
    where o.payment_status = 'paid'
      and o.paid_at >= s.opened_at and o.paid_at <= v_window_end
      and o.payment_method is not null
    group by o.payment_method
    order by o.payment_method
  ) m;

  select coalesce(sum(o.total), 0) into v_cash_total
  from public.orders o
  where o.payment_status = 'paid'
    and o.paid_at >= s.opened_at and o.paid_at <= v_window_end
    and o.payment_method = 'cash';

  v_expected := s.starting_cash + v_cash_total;

  select coalesce(json_agg(row_to_json(r)), '[]'::json) into v_transactions
  from (
    select
      o.id,
      (extract(epoch from o.paid_at) * 1000)::bigint as "paidAt",
      o.payment_method as "paymentMethod",
      o.total
    from public.orders o
    where o.payment_status = 'paid'
      and o.paid_at >= s.opened_at and o.paid_at <= v_window_end
      and o.payment_method is not null
    order by o.paid_at desc
  ) r;

  select coalesce(json_agg(row_to_json(w)), '[]'::json) into v_workers
  from (
    select
      sw.staff_id as "staffId",
      p.full_name as "fullName",
      (extract(epoch from sw.joined_at) * 1000)::bigint as "joinedAt",
      case when sw.left_at is null then null else (extract(epoch from sw.left_at) * 1000)::bigint end as "leftAt"
    from public.shift_workers sw
    join public.profiles p on p.id = sw.staff_id
    where sw.shift_id = s.id
    order by sw.joined_at
  ) w;

  select coalesce(json_agg(row_to_json(i)), '[]'::json) into v_items_sold
  from (
    select
      mi.id as "menuItemId",
      mi.name_vi as "nameVi",
      mi.name_en as "nameEn",
      sum(oi.quantity)::int as quantity,
      sum(oi.subtotal)::bigint as revenue
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    join public.menu_items mi on mi.id = oi.menu_item_id
    where o.payment_status = 'paid'
      and o.paid_at >= s.opened_at and o.paid_at <= v_window_end
    group by mi.id, mi.name_vi, mi.name_en
    order by quantity desc
  ) i;

  return json_build_object(
    'id', s.id,
    'openedAt', (extract(epoch from s.opened_at) * 1000)::bigint,
    'closedAt', case when s.closed_at is null then null else (extract(epoch from s.closed_at) * 1000)::bigint end,
    'openedByName', v_opened_by_name,
    'closedByName', v_closed_by_name,
    'plannedStartAt', case when s.planned_start_at is null then null else (extract(epoch from s.planned_start_at) * 1000)::bigint end,
    'plannedEndAt', case when s.planned_end_at is null then null else (extract(epoch from s.planned_end_at) * 1000)::bigint end,
    'startingCash', s.starting_cash,
    'countedCash', s.counted_cash,
    'notes', s.notes,
    'byMethod', v_by_method,
    'expectedCash', v_expected,
    'difference', case when s.counted_cash is null then null else s.counted_cash - v_expected end,
    'transactions', v_transactions,
    'workers', v_workers,
    'itemsSold', v_items_sold
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 5. open_shift: accept an optional planned start/end window and
--    auto-join the opener onto the roster.
-- ---------------------------------------------------------------------
create or replace function public.open_shift(
  p_starting_cash int,
  p_planned_start_at timestamptz default null,
  p_planned_end_at timestamptz default null
)
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_starting_cash is null or p_starting_cash < 0 then
    raise exception 'invalid_starting_cash';
  end if;
  begin
    insert into public.shifts (opened_by, starting_cash, planned_start_at, planned_end_at)
      values (auth.uid(), p_starting_cash, p_planned_start_at, p_planned_end_at)
      returning id into v_id;
  exception when unique_violation then
    raise exception 'shift_already_open';
  end;
  insert into public.shift_workers (shift_id, staff_id) values (v_id, auth.uid())
    on conflict (shift_id, staff_id) do nothing;
  return public.get_shift_report(v_id);
end;
$$;

-- ---------------------------------------------------------------------
-- 6. close_shift: also close out anyone still on the roster.
-- ---------------------------------------------------------------------
create or replace function public.close_shift(p_counted_cash int, p_notes text default null)
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_counted_cash is null or p_counted_cash < 0 then
    raise exception 'invalid_counted_cash';
  end if;
  update public.shifts
    set closed_at = now(), closed_by = auth.uid(),
        counted_cash = p_counted_cash, notes = p_notes
    where closed_at is null
    returning id into v_id;
  if v_id is null then
    raise exception 'no_open_shift';
  end if;
  update public.shift_workers set left_at = now()
    where shift_id = v_id and left_at is null;
  return public.get_shift_report(v_id);
end;
$$;

-- ---------------------------------------------------------------------
-- 7. join_shift / leave_shift: staff-safe RPCs for "other staff who
--    can work the same shift". Deliberately `security invoker`, like
--    the other shift RPCs in this file — shift_workers_staff_all RLS
--    (above) is the actual access gate, and unlike a plpgsql `IF`, an
--    RLS USING/WITH CHECK clause evaluates NULL as deny-by-default, so
--    an anonymous/no-profile caller is safely rejected without needing
--    the "is null or not in" plpgsql guard migration 0048 had to add
--    elsewhere.
-- ---------------------------------------------------------------------
create or replace function public.join_shift()
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_shift_id uuid;
begin
  select id into v_shift_id from public.shifts where closed_at is null;
  if v_shift_id is null then
    raise exception 'no_open_shift';
  end if;

  insert into public.shift_workers (shift_id, staff_id, joined_at, left_at)
    values (v_shift_id, auth.uid(), now(), null)
    on conflict (shift_id, staff_id) do update set joined_at = now(), left_at = null;

  return public.get_shift_report(v_shift_id);
end;
$$;

create or replace function public.leave_shift()
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_shift_id uuid;
begin
  select id into v_shift_id from public.shifts where closed_at is null;
  if v_shift_id is null then
    raise exception 'no_open_shift';
  end if;

  update public.shift_workers set left_at = now()
    where shift_id = v_shift_id and staff_id = auth.uid() and left_at is null;

  return public.get_shift_report(v_shift_id);
end;
$$;

-- ---------------------------------------------------------------------
-- 8. is_shift_open: guest-safe read so customer-facing pages (menu,
--    checkout) can show a "shop closed" state without exposing any
--    shift/financial data — narrow boolean only, same guest-safe RPC
--    pattern as notify_table_cleaning/increment_table_scan_count.
-- ---------------------------------------------------------------------
create or replace function public.is_shift_open()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.shifts where closed_at is null);
$$;

-- ---------------------------------------------------------------------
-- 9. get_shift_history: surface opener/closer full name per row.
-- ---------------------------------------------------------------------
create or replace function public.get_shift_history()
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result json;
begin
  select coalesce(json_agg(row_to_json(h)), '[]'::json) into v_result
  from (
    select
      s.id,
      (extract(epoch from s.opened_at) * 1000)::bigint as "openedAt",
      (extract(epoch from s.closed_at) * 1000)::bigint as "closedAt",
      po.full_name as "openedByName",
      pc.full_name as "closedByName",
      s.starting_cash as "startingCash",
      s.counted_cash as "countedCash",
      (s.counted_cash - (s.starting_cash + coalesce((
        select sum(o.total) from public.orders o
        where o.payment_status = 'paid'
          and o.paid_at >= s.opened_at and o.paid_at <= s.closed_at
          and o.payment_method = 'cash'
      ), 0)))::bigint as "difference",
      coalesce((
        select sum(o.total) from public.orders o
        where o.payment_status = 'paid'
          and o.paid_at >= s.opened_at and o.paid_at <= s.closed_at
      ), 0)::bigint as "totalRevenue"
    from public.shifts s
    left join public.profiles po on po.id = s.opened_by
    left join public.profiles pc on pc.id = s.closed_by
    where s.closed_at is not null
    order by s.closed_at desc
  ) h;

  return v_result;
end;
$$;

grant execute on function public.open_shift(int, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_shift_report(uuid) to authenticated;
grant execute on function public.close_shift(int, text) to authenticated;
grant execute on function public.join_shift() to authenticated;
grant execute on function public.leave_shift() to authenticated;
grant execute on function public.is_shift_open() to anon, authenticated;
grant execute on function public.get_shift_history() to authenticated;

-- ---------------------------------------------------------------------
-- 10. place_order: reject every new order — customer self-checkout and
--     POS alike, since both route through this single choke point —
--     while no shift is open. Full body carried forward from migration
--     0048 (the last prior definition) with the new gate inserted right
--     after the existing early validation.
-- ---------------------------------------------------------------------
create or replace function public.place_order(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid := auth.uid();
  v_order_type order_type := (p_payload->>'orderType')::order_type;
  v_table_id uuid := (p_payload->>'tableId')::uuid;
  v_payment_method payment_method := (p_payload->>'paymentMethod')::payment_method;
  v_promo_code text := upper(trim(coalesce(p_payload->>'promoCode', '')));
  v_redeem_points integer := coalesce((p_payload->>'redeemLoyaltyPoints')::integer, 0);
  v_payment_collected boolean := coalesce((p_payload->>'paymentCollected')::boolean, false);
  v_pay_at text := coalesce(p_payload->>'payAt', 'now');
  v_initial_status order_status;
  v_pickup_time timestamptz;
  v_item jsonb;
  v_line record;
  v_menu_item record;
  v_size_delta integer;
  v_modifier_delta integer;
  v_unit_price integer;
  v_line_subtotal integer;
  v_subtotal integer := 0;
  v_promo_discount integer := 0;
  v_loyalty_discount integer := 0;
  v_redemption_discount integer := 0;
  v_redeem_value integer;
  v_balance integer;
  v_loyalty_enabled boolean;
  v_tax_rate numeric(5,4);
  v_taxable integer;
  v_tax integer;
  v_total integer;
  v_order_id uuid;
  v_order_item_id uuid;
  v_modifier_id uuid;
  v_redemption_ids uuid[];
  v_redemption_id uuid;
  v_redemption record;
begin
  if not exists (select 1 from public.shifts where closed_at is null) then
    raise exception 'no_open_shift';
  end if;

  if v_pay_at = 'now' and v_payment_method is null then
    raise exception 'paymentMethod is required when payAt is now';
  end if;

  if v_payment_collected and (public.current_user_role() is null or public.current_user_role() not in ('staff', 'manager', 'admin')) then
    raise exception 'not_authorized';
  end if;

  v_pickup_time := case p_payload->>'pickupTime'
    when '15' then now() + interval '15 minutes'
    when '30' then now() + interval '30 minutes'
    else null
  end;

  v_initial_status := (case when v_pay_at = 'later' then 'paid' else 'pending_payment' end)::order_status;

  if v_redeem_points > 0 then
    if v_customer_id is null then
      raise exception 'guests cannot redeem loyalty points';
    end if;
    select loyalty_points_balance into v_balance from public.profiles where id = v_customer_id;
    if v_balance is null or v_redeem_points > v_balance then
      raise exception 'insufficient loyalty points balance';
    end if;
    select enabled into v_loyalty_enabled from public.loyalty_settings where id = 1;
    if not coalesce(v_loyalty_enabled, true) then
      raise exception 'loyalty_program_disabled';
    end if;
  end if;

  if jsonb_array_length(coalesce(p_payload->'redemptionIds', '[]'::jsonb)) > 0 then
    if v_customer_id is null then
      raise exception 'guests cannot apply reward redemptions';
    end if;
    select array_agg((x)::uuid) into v_redemption_ids
      from jsonb_array_elements_text(p_payload->'redemptionIds') x;

    foreach v_redemption_id in array v_redemption_ids
    loop
      select rr.id, rr.customer_id, rr.applied_order_id, rr.fulfilled_at, r.discount_value_vnd
        into v_redemption
        from public.reward_redemptions rr
        join public.rewards r on r.id = rr.reward_id
        where rr.id = v_redemption_id;

      if v_redemption.id is null or v_redemption.customer_id <> v_customer_id then
        raise exception 'invalid_redemption_code';
      end if;
      if v_redemption.applied_order_id is not null or v_redemption.fulfilled_at is not null then
        raise exception 'redemption_already_used';
      end if;
      if now() > public.get_redemption_expiry(v_redemption_id) then
        raise exception 'redemption_expired';
      end if;

      v_redemption_discount := v_redemption_discount + v_redemption.discount_value_vnd;
    end loop;
  end if;

  create temporary table _place_order_lines (
    menu_item_id uuid, size_id uuid, quantity integer, note text,
    unit_price integer, line_subtotal integer, modifier_ids uuid[], modifier_deltas integer[]
  ) on commit drop;

  for v_item in select * from jsonb_array_elements(p_payload->'items')
  loop
    select id, base_price, is_available into v_menu_item
      from public.menu_items where id = (v_item->>'menuItemId')::uuid;
    if v_menu_item.id is null then
      raise exception 'menu item % not found', v_item->>'menuItemId';
    end if;
    if not v_menu_item.is_available then
      raise exception 'menu item % is not available', v_item->>'menuItemId';
    end if;

    v_size_delta := 0;
    if (v_item->>'sizeId') is not null then
      select price_delta into v_size_delta from public.menu_item_sizes where id = (v_item->>'sizeId')::uuid;
      if v_size_delta is null then
        raise exception 'size % not found', v_item->>'sizeId';
      end if;
    end if;

    v_modifier_delta := 0;
    if jsonb_array_length(coalesce(v_item->'modifierIds', '[]'::jsonb)) > 0 then
      select coalesce(sum(price_delta), 0) into v_modifier_delta
        from public.modifiers
        where id in (select jsonb_array_elements_text(v_item->'modifierIds')::uuid);
    end if;

    v_unit_price := v_menu_item.base_price + v_size_delta + v_modifier_delta;
    v_line_subtotal := v_unit_price * (v_item->>'quantity')::integer;
    v_subtotal := v_subtotal + v_line_subtotal;

    insert into _place_order_lines (menu_item_id, size_id, quantity, note, unit_price, line_subtotal, modifier_ids)
    values (
      v_menu_item.id,
      (v_item->>'sizeId')::uuid,
      (v_item->>'quantity')::integer,
      v_item->>'note',
      v_unit_price,
      v_line_subtotal,
      case when jsonb_array_length(coalesce(v_item->'modifierIds', '[]'::jsonb)) > 0
        then (select array_agg((x)::uuid) from jsonb_array_elements_text(v_item->'modifierIds') x)
        else array[]::uuid[]
      end
    );
  end loop;

  if v_promo_code = 'WELCOME10' then
    v_promo_discount := round(v_subtotal * 0.1);
  end if;

  if v_redeem_points > 0 then
    select redeem_value_vnd_per_point into v_redeem_value from public.loyalty_settings where id = 1;
    v_loyalty_discount := v_redeem_points * v_redeem_value;
  end if;

  select tax_rate into v_tax_rate from public.shop_settings where id = 1;
  v_taxable := greatest(v_subtotal - v_promo_discount - v_loyalty_discount - v_redemption_discount, 0);
  v_tax := round(v_taxable * coalesce(v_tax_rate, 0));
  v_total := v_taxable + v_tax;

  insert into public.orders (
    customer_id, order_type, table_id, status, payment_method, payment_status,
    subtotal, discount_amount, tax_amount, total, pickup_time
  ) values (
    v_customer_id, v_order_type, v_table_id, v_initial_status, v_payment_method, 'pending',
    v_subtotal, v_promo_discount + v_loyalty_discount + v_redemption_discount, v_tax, v_total,
    v_pickup_time
  ) returning id into v_order_id;

  for v_line in select * from _place_order_lines
  loop
    insert into public.order_items (order_id, menu_item_id, size_id, quantity, unit_price, subtotal, note)
    values (v_order_id, v_line.menu_item_id, v_line.size_id, v_line.quantity, v_line.unit_price, v_line.line_subtotal, v_line.note)
    returning id into v_order_item_id;

    if v_line.modifier_ids is not null and array_length(v_line.modifier_ids, 1) > 0 then
      foreach v_modifier_id in array v_line.modifier_ids
      loop
        insert into public.order_item_modifiers (order_item_id, modifier_id, price_delta)
        select v_order_item_id, v_modifier_id, price_delta from public.modifiers where id = v_modifier_id;
      end loop;
    end if;
  end loop;

  if v_redeem_points > 0 then
    insert into public.loyalty_transactions (customer_id, order_id, points_change, type)
    values (v_customer_id, v_order_id, -v_redeem_points, 'redeem');
    update public.profiles set loyalty_points_balance = loyalty_points_balance - v_redeem_points
      where id = v_customer_id;
  end if;

  if v_redemption_ids is not null and array_length(v_redemption_ids, 1) > 0 then
    update public.reward_redemptions set applied_order_id = v_order_id
      where id = any(v_redemption_ids);
  end if;

  if v_payment_collected then
    update public.orders set status = 'paid', payment_status = 'paid' where id = v_order_id;
  end if;

  return jsonb_build_object('orderId', v_order_id, 'taxAmount', v_tax, 'total', v_total);
end;
$$;

-- ---------------------------------------------------------------------
-- 11. Realtime: shift open/close/join/leave never touches `orders`, so
--     without this, other staff wouldn't see shift state change live.
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.shifts;
alter publication supabase_realtime add table public.shift_workers;
