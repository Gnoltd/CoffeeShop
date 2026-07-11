-- 0040_reward_redemption_checkout.sql
-- Turns a redeemed reward into something a customer can actually spend:
-- self-service application at checkout (place_order), a real "My
-- Redemptions" status list (get_my_redemptions), and a dynamic 1-year
-- expiry that resets to "1 year from now" whenever the customer's total
-- paid spend since redeeming exceeds 1,000,000 VND (computed live, not
-- a stored/cron-updated column, since the "still active" condition can
-- flip at any time).
--
-- Every reward is now worth a flat VND amount at checkout
-- (discount_value_vnd) rather than being tied to a specific menu item —
-- keeps "Free Black Coffee" and "20,000₫ Off" applying the exact same
-- way, no per-item cart-matching logic needed. Seeded from this
-- project's real menu prices at the time (Black Coffee 25,000₫,
-- Butter Croissant 28,000₫, size-upgrade delta 8,000₫).

alter table public.rewards add column discount_value_vnd integer not null default 0;

update public.rewards set discount_value_vnd = 25000 where name_en = 'Free Black Coffee';
update public.rewards set discount_value_vnd = 28000 where name_en = 'Free Pastry';
update public.rewards set discount_value_vnd = 20000 where name_en = '20,000₫ Off';
update public.rewards set discount_value_vnd = 8000 where name_en = 'Free Size Upgrade';

alter table public.reward_redemptions add column applied_order_id uuid references public.orders(id);

-- security definer: needs to read another customer's orders in principle
-- (called from place_order for the ordering customer), but only ever
-- computes a value, never exposes rows directly.
create or replace function public.get_redemption_expiry(p_redemption_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reward_redemptions%rowtype;
  v_spend_since bigint;
begin
  select * into r from public.reward_redemptions where id = p_redemption_id;
  if r.id is null then
    return null;
  end if;

  select coalesce(sum(o.total), 0) into v_spend_since
    from public.orders o
    where o.customer_id = r.customer_id
      and o.payment_status = 'paid'
      and o.paid_at >= r.redeemed_at;

  if v_spend_since > 1000000 then
    return now() + interval '1 year';
  end if;
  return r.redeemed_at + interval '1 year';
end;
$$;

grant execute on function public.get_redemption_expiry(uuid) to authenticated;

create or replace function public.get_my_redemptions()
returns table (
  id uuid,
  reward_name_vi text,
  reward_name_en text,
  points_spent integer,
  discount_value_vnd integer,
  redeemed_at timestamptz,
  applied_order_id uuid,
  fulfilled_at timestamptz,
  expires_at timestamptz,
  is_used boolean,
  is_expired boolean
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_customer_id uuid := auth.uid();
begin
  if v_customer_id is null then
    raise exception 'not_authenticated';
  end if;

  return query
  select
    rr.id,
    r.name_vi,
    r.name_en,
    rr.points_spent,
    r.discount_value_vnd,
    rr.redeemed_at,
    rr.applied_order_id,
    rr.fulfilled_at,
    public.get_redemption_expiry(rr.id),
    (rr.applied_order_id is not null or rr.fulfilled_at is not null),
    (rr.applied_order_id is null and rr.fulfilled_at is null and now() > public.get_redemption_expiry(rr.id))
  from public.reward_redemptions rr
  join public.rewards r on r.id = rr.reward_id
  where rr.customer_id = v_customer_id
  order by rr.redeemed_at desc;
end;
$$;

grant execute on function public.get_my_redemptions() to authenticated;

-- place_order: adds redemptionIds (jsonb array of reward_redemptions.id,
-- multiple allowed per order per explicit decision) alongside the
-- existing promoCode/redeemLoyaltyPoints discounts. Every other line is
-- unchanged from the live 0023 definition (payAt/initial-status logic
-- etc.) -- only the discount computation and a post-insert update are
-- new.
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
  v_order_id uuid;
  v_order_item_id uuid;
  v_modifier_id uuid;
  v_redemption_ids uuid[];
  v_redemption_id uuid;
  v_redemption record;
begin
  if v_pay_at = 'now' and v_payment_method is null then
    raise exception 'paymentMethod is required when payAt is now';
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

  insert into public.orders (
    customer_id, order_type, table_id, status, payment_method, payment_status,
    subtotal, discount_amount, total, pickup_time
  ) values (
    v_customer_id, v_order_type, v_table_id, v_initial_status, v_payment_method, 'pending',
    v_subtotal, v_promo_discount + v_loyalty_discount + v_redemption_discount,
    greatest(v_subtotal - v_promo_discount - v_loyalty_discount - v_redemption_discount, 0),
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

  return jsonb_build_object(
    'orderId', v_order_id,
    'total', greatest(v_subtotal - v_promo_discount - v_loyalty_discount - v_redemption_discount, 0)
  );
end;
$$;

grant execute on function public.place_order(jsonb) to anon, authenticated;
