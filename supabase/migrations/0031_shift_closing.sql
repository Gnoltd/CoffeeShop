-- 0031_shift_closing.sql
-- Shift closing: cash-drawer shifts with starting cash, per-method
-- breakdown, expected ending cash, counted cash + over/short.
-- Design: docs/superpowers/specs/2026-07-10-shift-closing-design.md
--
-- orders.paid_at: neither created_at nor updated_at can attribute a
-- payment to a shift window (Pay Later orders are paid long after
-- creation; updated_at moves on every touch). Stamped by an UNSCOPED
-- before-trigger (migration 0024's lesson: no OF column scope) the
-- moment payment_status is 'paid' and paid_at is still null.

alter table public.orders add column paid_at timestamptz;

create or replace function public.set_order_paid_at()
returns trigger
language plpgsql
as $$
begin
  if new.payment_status = 'paid' and new.paid_at is null then
    new.paid_at := now();
  end if;
  return new;
end;
$$;

create trigger on_order_set_paid_at
  before insert or update on public.orders
  for each row execute function public.set_order_paid_at();

-- One-time backfill: best available approximation for already-paid rows.
update public.orders set paid_at = updated_at
  where payment_status = 'paid' and paid_at is null;

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opened_by uuid not null references public.profiles(id),
  closed_by uuid references public.profiles(id),
  starting_cash integer not null,
  counted_cash integer,
  notes text
);

-- One shop, one drawer: at most one open shift at a time.
create unique index shifts_one_open on public.shifts ((true)) where closed_at is null;

alter table public.shifts enable row level security;

create policy "shifts_manager_admin_all" on public.shifts
  for all
  using (public.current_user_role() in ('manager', 'admin'))
  with check (public.current_user_role() in ('manager', 'admin'));

-- Report builder shared by get_shift_report and close_shift.
-- security invoker: shifts RLS is the access gate; orders are already
-- staff-readable (orders_select_staff).
create or replace function public.get_shift_report(p_shift_id uuid default null)
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
  s public.shifts%rowtype;
  v_window_end timestamptz;
  v_by_method json;
  v_cash_total bigint;
  v_expected bigint;
  v_transactions json;
begin
  if p_shift_id is null then
    select * into s from public.shifts where closed_at is null;
  else
    select * into s from public.shifts where id = p_shift_id;
  end if;
  if s.id is null then
    return null;
  end if;

  v_window_end := coalesce(s.closed_at, now());

  select coalesce(json_agg(row_to_json(m)), '[]'::json) into v_by_method
  from (
    select o.payment_method as method, count(*)::int as count, coalesce(sum(o.total), 0)::bigint as total
    from public.orders o
    where o.payment_status = 'paid'
      and o.paid_at >= s.opened_at and o.paid_at <= v_window_end
      and o.payment_method is not null
    group by o.payment_method
    order by o.payment_method
  ) m;

  select coalesce(sum(o.total), 0) into v_cash_total
  from public.orders o
  where o.payment_status = 'paid'
    and o.paid_at >= s.opened_at and o.paid_at <= v_window_end
    and o.payment_method = 'cash';

  v_expected := s.starting_cash + v_cash_total;

  select coalesce(json_agg(row_to_json(r)), '[]'::json) into v_transactions
  from (
    select
      o.id,
      (extract(epoch from o.paid_at) * 1000)::bigint as "paidAt",
      o.payment_method as "paymentMethod",
      o.total
    from public.orders o
    where o.payment_status = 'paid'
      and o.paid_at >= s.opened_at and o.paid_at <= v_window_end
      and o.payment_method is not null
    order by o.paid_at desc
  ) r;

  return json_build_object(
    'id', s.id,
    'openedAt', (extract(epoch from s.opened_at) * 1000)::bigint,
    'closedAt', case when s.closed_at is null then null else (extract(epoch from s.closed_at) * 1000)::bigint end,
    'startingCash', s.starting_cash,
    'countedCash', s.counted_cash,
    'notes', s.notes,
    'byMethod', v_by_method,
    'expectedCash', v_expected,
    'difference', case when s.counted_cash is null then null else s.counted_cash - v_expected end,
    'transactions', v_transactions
  );
end;
$$;

create or replace function public.open_shift(p_starting_cash int)
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_starting_cash is null or p_starting_cash < 0 then
    raise exception 'invalid_starting_cash';
  end if;
  begin
    insert into public.shifts (opened_by, starting_cash)
      values (auth.uid(), p_starting_cash)
      returning id into v_id;
  exception when unique_violation then
    raise exception 'shift_already_open';
  end;
  return public.get_shift_report(v_id);
end;
$$;

create or replace function public.close_shift(p_counted_cash int, p_notes text default null)
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_counted_cash is null or p_counted_cash < 0 then
    raise exception 'invalid_counted_cash';
  end if;
  update public.shifts
    set closed_at = now(), closed_by = auth.uid(),
        counted_cash = p_counted_cash, notes = p_notes
    where closed_at is null
    returning id into v_id;
  if v_id is null then
    raise exception 'no_open_shift';
  end if;
  return public.get_shift_report(v_id);
end;
$$;

grant execute on function public.open_shift(int) to authenticated;
grant execute on function public.get_shift_report(uuid) to authenticated;
grant execute on function public.close_shift(int, text) to authenticated;
