-- 0042_real_shop_and_loyalty_settings.sql
-- Admin Settings (components/admin/settings-view.tsx) was 100% mock —
-- useState only, never read/wrote shop_settings or loyalty_settings
-- despite both tables (and their RLS) existing since migration 0002.
-- Worse: POS's tax display (`TAX_RATE = 0.08` constant) was never even
-- sent to place_order, which recomputed the total server-side with no
-- tax at all -- the number shown to staff was pure client-side
-- decoration, never actually charged or recorded. This makes tax real
-- end-to-end (POS and online checkout both, admin's real rate), and
-- makes the "Enable Program" loyalty toggle actually gate earning and
-- redemption instead of doing nothing.

alter table public.loyalty_settings add column enabled boolean not null default true;
alter table public.orders add column tax_amount integer not null default 0;

-- place_order: adds tax (computed from shop_settings.tax_rate, applied
-- to the post-discount subtotal, added to total) and a loyalty_settings
-- .enabled gate on point redemption. Every other line unchanged from
-- the live 0040 definition.
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

grant execute on function public.place_order(jsonb) to anon, authenticated;

-- handle_order_paid: skip earning entirely when the loyalty program is
-- disabled. Unchanged otherwise from the live 0007 definition.
create or replace function public.handle_order_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  earn_rate integer;
  loyalty_enabled boolean;
  points integer;
  oi record;
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    for oi in
      select id as order_item_id, menu_item_id, quantity
      from public.order_items
      where order_id = new.id
    loop
      update public.ingredients ing
      set stock_quantity = stock_quantity - (mii.quantity_used * oi.quantity)
      from public.menu_item_ingredients mii
      where mii.ingredient_id = ing.id and mii.menu_item_id = oi.menu_item_id;

      insert into public.inventory_logs (ingredient_id, change_quantity, reason, reference_order_id)
      select mii.ingredient_id, -(mii.quantity_used * oi.quantity), 'order_deduction', new.id
      from public.menu_item_ingredients mii
      where mii.menu_item_id = oi.menu_item_id;

      update public.ingredients ing
      set stock_quantity = stock_quantity - (mi.quantity_used * oi.quantity)
      from public.order_item_modifiers oim
      join public.modifier_ingredients mi on mi.modifier_id = oim.modifier_id
      where oim.order_item_id = oi.order_item_id and mi.ingredient_id = ing.id;

      insert into public.inventory_logs (ingredient_id, change_quantity, reason, reference_order_id)
      select mi.ingredient_id, -(mi.quantity_used * oi.quantity), 'order_deduction', new.id
      from public.order_item_modifiers oim
      join public.modifier_ingredients mi on mi.modifier_id = oim.modifier_id
      where oim.order_item_id = oi.order_item_id;
    end loop;

    select earn_rate_vnd_per_point, enabled into earn_rate, loyalty_enabled from public.loyalty_settings where id = 1;
    new.loyalty_points_earned := 0;
    if new.customer_id is not null and earn_rate > 0 and coalesce(loyalty_enabled, true) then
      points := floor(new.total / earn_rate);
      if points > 0 then
        insert into public.loyalty_transactions (customer_id, order_id, points_change, type)
        values (new.customer_id, new.id, points, 'earn');

        update public.profiles
        set loyalty_points_balance = loyalty_points_balance + points
        where id = new.customer_id;

        new.loyalty_points_earned := points;
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- get_order_for_tracking: surface taxAmount so the customer's own
-- tracking/history detail reflects the real charged tax, not just the
-- database total. Unchanged otherwise from the live definition.
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
    'paymentStatus', o.payment_status,
    'paymentMethod', o.payment_method,
    'subtotal', o.subtotal,
    'discount', o.discount_amount,
    'taxAmount', o.tax_amount,
    'total', o.total,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'menuItemId', oi.menu_item_id,
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
