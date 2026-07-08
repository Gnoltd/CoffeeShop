-- 0026_dashboard_stats_fn.sql
-- Real Admin Dashboard data: today's revenue/orders/loyalty, a rolling
-- 7-day revenue chart, and best sellers -- all Vietnam-local ("today"
-- via `at time zone 'Asia/Ho_Chi_Minh'`, matching the precedent
-- already set by place-order's VNPay date handling). security invoker,
-- not definer -- orders_select_staff/order_items_select/
-- loyalty_transactions_select_staff already grant staff/manager/admin
-- full read access, and this dashboard is manager/admin-only via
-- middleware anyway. See
-- docs/superpowers/specs/2026-07-08-admin-dashboard-real-data-design.md.

create or replace function public.get_dashboard_stats()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_result jsonb;
begin
  select jsonb_build_object(
    'todayRevenue', coalesce((
      select sum(total) from public.orders
      where payment_status = 'paid'
        and (created_at at time zone 'Asia/Ho_Chi_Minh')::date = v_today
    ), 0),
    'ordersToday', coalesce((
      select count(*) from public.orders
      where payment_status = 'paid'
        and (created_at at time zone 'Asia/Ho_Chi_Minh')::date = v_today
    ), 0),
    'loyaltyIssuedToday', coalesce((
      select sum(points_change) from public.loyalty_transactions
      where type = 'earn'
        and (created_at at time zone 'Asia/Ho_Chi_Minh')::date = v_today
    ), 0),
    'sevenDayRevenue', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'date', to_char(d::date, 'YYYY-MM-DD'), 'revenue', coalesce(r.revenue, 0)
      ) order by d), '[]'::jsonb)
      from generate_series(v_today - 6, v_today, interval '1 day') d
      left join (
        select (created_at at time zone 'Asia/Ho_Chi_Minh')::date as day, sum(total) as revenue
        from public.orders
        where payment_status = 'paid'
          and (created_at at time zone 'Asia/Ho_Chi_Minh')::date between v_today - 6 and v_today
        group by 1
      ) r on r.day = d::date
    ),
    'bestSellers', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'nameVi', mi.name_vi, 'nameEn', mi.name_en, 'quantitySold', s.quantity_sold
      ) order by s.quantity_sold desc), '[]'::jsonb)
      from (
        select oi.menu_item_id, sum(oi.quantity) as quantity_sold
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
        where o.payment_status = 'paid'
          and (o.created_at at time zone 'Asia/Ho_Chi_Minh')::date between v_today - 6 and v_today
        group by oi.menu_item_id
        order by quantity_sold desc
        limit 3
      ) s
      join public.menu_items mi on mi.id = s.menu_item_id
    )
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_dashboard_stats() to authenticated;
