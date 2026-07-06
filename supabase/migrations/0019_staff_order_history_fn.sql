-- 0019_staff_order_history_fn.sql
-- Staff-facing Order History search: one round trip returning a page of
-- completed/cancelled orders plus a total count, matching p_search
-- against the short order-id prefix, table number, or customer
-- name/phone. security invoker (not definer) — RLS already grants
-- staff/manager/admin full read on orders/tables/profiles via
-- orders_select_staff/tables_select_all/profiles_select_staff, so no
-- bypass is needed. Defaults (completed/cancelled statuses, last-7-days
-- range) are enforced here, not just client-side, so a client bug can't
-- accidentally pull active orders or the whole table's history.

create or replace function public.get_order_history(
  p_date_from date default null,
  p_date_to date default null,
  p_statuses order_status[] default array['completed', 'cancelled']::order_status[],
  p_order_type order_type default null,
  p_search text default null,
  p_limit int default 20,
  p_offset int default 0
) returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_date_to date := coalesce(p_date_to, current_date);
  v_date_from date := coalesce(p_date_from, v_date_to - 7);
  v_from date := least(v_date_from, v_date_to);
  v_to date := greatest(v_date_from, v_date_to);
  v_rows json;
  v_total bigint;
begin
  select count(*) into v_total
  from public.orders o
  left join public.tables tb on tb.id = o.table_id
  left join public.profiles p on p.id = o.customer_id
  where o.status = any(p_statuses)
    and o.created_at::date between v_from and v_to
    and (p_order_type is null or o.order_type = p_order_type)
    and (
      p_search is null or p_search = '' or
      o.id::text ilike p_search || '%' or
      tb.table_number ilike '%' || p_search || '%' or
      p.full_name ilike '%' || p_search || '%' or
      p.phone ilike '%' || p_search || '%'
    );

  select coalesce(json_agg(row_to_json(r)), '[]'::json) into v_rows
  from (
    select
      o.id,
      o.created_at,
      o.order_type,
      tb.table_number as table_number,
      p.full_name as customer_name,
      o.payment_method,
      o.status,
      o.total
    from public.orders o
    left join public.tables tb on tb.id = o.table_id
    left join public.profiles p on p.id = o.customer_id
    where o.status = any(p_statuses)
      and o.created_at::date between v_from and v_to
      and (p_order_type is null or o.order_type = p_order_type)
      and (
        p_search is null or p_search = '' or
        o.id::text ilike p_search || '%' or
        tb.table_number ilike '%' || p_search || '%' or
        p.full_name ilike '%' || p_search || '%' or
        p.phone ilike '%' || p_search || '%'
      )
    order by o.created_at desc
    limit p_limit offset p_offset
  ) r;

  return json_build_object('rows', v_rows, 'totalCount', v_total);
end;
$$;

grant execute on function public.get_order_history(date, date, order_status[], order_type, text, int, int) to authenticated;
