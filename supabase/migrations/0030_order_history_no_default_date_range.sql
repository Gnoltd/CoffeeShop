-- 0030_order_history_no_default_date_range.sql
-- Real bug reported live: staff/admin using Order History stopped
-- seeing older orders over time. get_order_history (migration 0019)
-- was deliberately defaulting an unset date range to the last 7 days
-- ("so a client bug can't accidentally pull... the whole table's
-- history") -- but the date pickers pre-filling with that computed
-- range gave no visible indication a filter was even active, so orders
-- older than a week silently disappeared from the default view.
-- Product decision (confirmed with user): remove the default window
-- entirely -- no date filter means all time, matching the unbounded
-- behavior customers already get from their own order history.

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
  v_statuses order_status[] := coalesce(p_statuses, array['completed', 'cancelled']::order_status[]);
  v_rows json;
  v_total bigint;
begin
  select count(*) into v_total
  from public.orders o
  left join public.tables tb on tb.id = o.table_id
  left join public.profiles p on p.id = o.customer_id
  where o.status = any(v_statuses)
    and (p_date_from is null or o.created_at::date >= p_date_from)
    and (p_date_to is null or o.created_at::date <= p_date_to)
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
    where o.status = any(v_statuses)
      and (p_date_from is null or o.created_at::date >= p_date_from)
      and (p_date_to is null or o.created_at::date <= p_date_to)
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
