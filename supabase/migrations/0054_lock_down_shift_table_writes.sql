-- 0054_lock_down_shift_table_writes.sql
-- Security fix for migration 0053: its new shifts_staff_all/
-- shift_workers_staff_all RLS policies were unscoped `FOR ALL` (role
-- check only, no `closed_at is null`/`staff_id = auth.uid()` row
-- scoping). Because open_shift/close_shift/join_shift/leave_shift are
-- `security invoker`, RLS -- not the RPCs' own WHERE-clause guards --
-- was the actual write gate for these tables, so any staff-role JWT
-- could bypass every RPC entirely via a direct PostgREST call: rewrite
-- an already-closed shift's counted_cash/notes to hide a cash-drawer
-- shortfall, delete a shift's financial record outright, or edit a
-- coworker's shift_workers roster row directly. Same bug shape already
-- fixed once in this project for orders/order_items direct-insert
-- forgery (migration 0046).
--
-- Fix: shifts/shift_workers RLS becomes SELECT-only for staff/manager/
-- admin (reports still need to read them); every write moves fully
-- behind the four RPCs, converted invoker -> definer with an internal
-- role check taking over what RLS used to enforce -- the exact
-- remediation pattern already used for regenerate_table_qr_token
-- (migration 0046). The "is null or not in" guard shape matches
-- migration 0048's fix for the NULL-bypasses-NOT-IN class of bug.

drop policy if exists "shifts_staff_all" on public.shifts;
drop policy if exists "shift_workers_staff_all" on public.shift_workers;

create policy "shifts_select_staff" on public.shifts
  for select
  using (public.current_user_role() in ('staff', 'manager', 'admin'));

create policy "shift_workers_select_staff" on public.shift_workers
  for select
  using (public.current_user_role() in ('staff', 'manager', 'admin'));

-- No insert/update/delete policy remains on either table for any role:
-- RLS denies by default when no policy matches an operation, and the
-- four security-definer RPCs below are the only remaining write path.

create or replace function public.open_shift(
  p_starting_cash int,
  p_planned_start_at timestamptz default null,
  p_planned_end_at timestamptz default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if public.current_user_role() is null or public.current_user_role() not in ('staff', 'manager', 'admin') then
    raise exception 'not_authorized';
  end if;
  if p_starting_cash is null or p_starting_cash < 0 then
    raise exception 'invalid_starting_cash';
  end if;
  begin
    insert into public.shifts (opened_by, starting_cash, planned_start_at, planned_end_at)
      values (auth.uid(), p_starting_cash, p_planned_start_at, p_planned_end_at)
      returning id into v_id;
  exception when unique_violation then
    raise exception 'shift_already_open';
  end;
  insert into public.shift_workers (shift_id, staff_id) values (v_id, auth.uid())
    on conflict (shift_id, staff_id) do nothing;
  return public.get_shift_report(v_id);
end;
$$;

create or replace function public.close_shift(p_counted_cash int, p_notes text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if public.current_user_role() is null or public.current_user_role() not in ('staff', 'manager', 'admin') then
    raise exception 'not_authorized';
  end if;
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
  update public.shift_workers set left_at = now()
    where shift_id = v_id and left_at is null;
  return public.get_shift_report(v_id);
end;
$$;

create or replace function public.join_shift()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift_id uuid;
begin
  if public.current_user_role() is null or public.current_user_role() not in ('staff', 'manager', 'admin') then
    raise exception 'not_authorized';
  end if;

  select id into v_shift_id from public.shifts where closed_at is null;
  if v_shift_id is null then
    raise exception 'no_open_shift';
  end if;

  insert into public.shift_workers (shift_id, staff_id, joined_at, left_at)
    values (v_shift_id, auth.uid(), now(), null)
    on conflict (shift_id, staff_id) do update set joined_at = now(), left_at = null;

  return public.get_shift_report(v_shift_id);
end;
$$;

create or replace function public.leave_shift()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift_id uuid;
begin
  if public.current_user_role() is null or public.current_user_role() not in ('staff', 'manager', 'admin') then
    raise exception 'not_authorized';
  end if;

  select id into v_shift_id from public.shifts where closed_at is null;
  if v_shift_id is null then
    raise exception 'no_open_shift';
  end if;

  update public.shift_workers set left_at = now()
    where shift_id = v_shift_id and staff_id = auth.uid() and left_at is null;

  return public.get_shift_report(v_shift_id);
end;
$$;
