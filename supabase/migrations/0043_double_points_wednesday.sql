-- 0043_double_points_wednesday.sql
-- The Loyalty page's "Double Points Wednesday" banner (static marketing
-- copy, Loyalty.promoTitle/promoSubtitle) made a concrete factual claim
-- with no real behavior behind it -- handle_order_paid always earned at
-- a flat rate regardless of day of week, including on Wednesdays. This
-- makes the promise real: points double when an order is marked paid
-- on a Wednesday, evaluated in the shop's actual local timezone
-- (Asia/Ho_Chi_Minh) rather than the database's UTC -- "Wednesday"
-- means the day for a customer in Vietnam, not whatever day UTC
-- happens to be at that instant. Deliberately keyed off payment time
-- (when points are actually earned), not order-creation time.

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
      if extract(dow from now() at time zone 'Asia/Ho_Chi_Minh') = 3 then
        points := points * 2;
      end if;
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
