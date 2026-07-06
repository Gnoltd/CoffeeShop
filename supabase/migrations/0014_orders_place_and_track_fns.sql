-- 0014_orders_place_and_track_fns.sql
-- A missing note column on order_items (found while designing
-- place_order — customers can already attach a free-text per-item note
-- in Cart/Checkout, but the real schema had nowhere to store it), plus
-- two RPCs for real order placement and lookup:
--   place_order — security definer, atomic, server-computed prices/
--     discounts (never trusts client-supplied money values). Always
--     inserts at payment_status='pending', then a genuine second update
--     to 'paid' when payment was already collected (POS) — required
--     because handle_order_paid (migration 0007) is a `before update`
--     trigger and cannot fire on insert. pickupTime arrives as a
--     semantic token ("asap"/"15"/"30"/"schedule") from the UI, not a
--     literal timestamp — orders.pickup_time is timestamptz, so this
--     function converts it server-side (found and fixed during live
--     verification: the naive text-cast version failed immediately).
--   get_order_for_tracking — security definer, single-row lookup only
--     (order id is a required parameter), so a guest's own order (whose
--     customer_id is null) can be read without a broad RLS policy that
--     would let any guest bulk-read every other guest's order.

alter table public.order_items add column note text;

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
  v_redeem_value integer;
  v_balance integer;
  v_order_id uuid;
  v_order_item_id uuid;
  v_modifier_id uuid;
begin
  v_pickup_time := case p_payload->>'pickupTime'
    when '15' then now() + interval '15 minutes'
    when '30' then now() + interval '30 minutes'
    else null
  end;

  if v_redeem_points > 0 then
    if v_customer_id is null then
      raise exception 'guests cannot redeem loyalty points';
    end if;
    select loyalty_points_balance into v_balance from public.profiles where id = v_customer_id;
    if v_balance is null or v_redeem_points > v_balance then
      raise exception 'insufficient loyalty points balance';
    end if;
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
    v_customer_id, v_order_type, v_table_id, 'pending_payment', v_payment_method, 'pending',
    v_subtotal, v_promo_discount + v_loyalty_discount,
    greatest(v_subtotal - v_promo_discount - v_loyalty_discount, 0),
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

  if v_payment_collected then
    update public.orders set status = 'paid', payment_status = 'paid' where id = v_order_id;
  end if;

  return jsonb_build_object('orderId', v_order_id, 'total', greatest(v_subtotal - v_promo_discount - v_loyalty_discount, 0));
end;
$$;

grant execute on function public.place_order(jsonb) to anon, authenticated;

create or replace function public.get_order_for_tracking(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'id', o.id,
    'createdAt', extract(epoch from o.created_at) * 1000,
    'orderType', o.order_type,
    'table', t.table_number,
    'status', o.status,
    'subtotal', o.subtotal,
    'discount', o.discount_amount,
    'total', o.total,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nameVi', mi.name_vi, 'nameEn', mi.name_en,
        'quantity', oi.quantity, 'unitPrice', oi.unit_price, 'note', oi.note
      ))
      from public.order_items oi
      join public.menu_items mi on mi.id = oi.menu_item_id
      where oi.order_id = o.id
    ), '[]'::jsonb)
  ) into v_result
  from public.orders o
  left join public.tables t on t.id = o.table_id
  where o.id = p_order_id
    and (
      o.customer_id = auth.uid()
      or o.customer_id is null
      or public.current_user_role() in ('staff', 'manager', 'admin')
    );

  return v_result;
end;
$$;

grant execute on function public.get_order_for_tracking(uuid) to anon, authenticated;
