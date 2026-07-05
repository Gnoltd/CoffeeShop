-- trigger: deduct inventory + earn loyalty points when an order is marked paid

create or replace function public.handle_order_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  earn_rate integer;
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

    select earn_rate_vnd_per_point into earn_rate from public.loyalty_settings where id = 1;
    new.loyalty_points_earned := 0;
    if new.customer_id is not null and earn_rate > 0 then
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

create trigger on_order_paid
  before update on public.orders
  for each row
  execute function public.handle_order_paid();
