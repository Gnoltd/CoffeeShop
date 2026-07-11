-- 0036_shift_history.sql
-- Shift Closing gap fix: get_shift_report(p_shift_id) already supported
-- fetching a single past shift, but there was no way to list past shifts
-- at all -- closing a shift only ever showed its summary in transient
-- local state, lost on navigation/reload. This adds a listing RPC; the
-- UI reuses the existing get_shift_report(id) for per-shift detail.

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
      s.starting_cash as "startingCash",
      s.counted_cash as "countedCash",
      s.counted_cash - (
        s.starting_cash + coalesce((
          select sum(o.total) from public.orders o
          where o.payment_status = 'paid' and o.payment_method = 'cash'
            and o.paid_at >= s.opened_at and o.paid_at <= s.closed_at
        ), 0)
      ) as "difference",
      coalesce((
        select sum(o.total) from public.orders o
        where o.payment_status = 'paid'
          and o.paid_at >= s.opened_at and o.paid_at <= s.closed_at
      ), 0) as "totalRevenue"
    from public.shifts s
    where s.closed_at is not null
    order by s.closed_at desc
  ) h;
  return v_result;
end;
$$;

grant execute on function public.get_shift_history() to authenticated;
