-- 0029_get_order_for_tracking_menu_item_id.sql
-- Real gap caught while wiring up review submission from the customer's
-- Order Tracking/History detail page: that page's data comes from
-- get_order_for_tracking, a completely separate path from getMyOrders's
-- direct order_items select -- and this RPC's items json never included
-- menu_item_id, so a "Rate & Review" action on that page would have had
-- no item id to submit a review against. Based on the function's current
-- live definition (migration 0022, which added paymentStatus/
-- paymentMethod on top of 0014's original) -- adds menuItemId alongside,
-- no other behavior change.

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
