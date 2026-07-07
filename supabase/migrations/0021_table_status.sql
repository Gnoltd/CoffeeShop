-- 0021_table_status.sql
-- Replaces tables.is_occupied (boolean) with a 3-state status enum
-- (available/occupied/cleaning), driven by an orders trigger, plus a
-- guest-safe RPC for flagging an uncleaned table. See
-- docs/superpowers/specs/2026-07-08-table-status-design.md.

create type public.table_occupancy_status as enum ('available', 'occupied', 'cleaning');

alter table public.tables add column status public.table_occupancy_status not null default 'available';
update public.tables set status = (case when is_occupied then 'occupied' else 'available' end)::public.table_occupancy_status;
alter table public.tables drop column is_occupied;

alter table public.tables add column cleaning_notified_at timestamptz;

create or replace function public.sync_table_occupancy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.order_type = 'dine_in' and new.table_id is not null then
      update public.tables
      set status = 'occupied', cleaning_notified_at = null
      where id = new.table_id;
    end if;
    return new;
  end if;

  if new.table_id is not null
     and new.status in ('completed', 'cancelled')
     and old.status not in ('completed', 'cancelled') then
    if not exists (
      select 1 from public.orders
      where table_id = new.table_id
        and status not in ('completed', 'cancelled')
        and id <> new.id
    ) then
      update public.tables set status = 'cleaning' where id = new.table_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_order_table_occupancy on public.orders;
create trigger on_order_table_occupancy
  after insert or update of status on public.orders
  for each row
  execute function public.sync_table_occupancy();

create or replace function public.notify_table_cleaning(
  p_table_id uuid
) returns public.tables
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.tables;
begin
  update public.tables
    set cleaning_notified_at = now()
    where id = p_table_id and status = 'cleaning'
    returning * into v_row;

  if v_row.id is null then
    raise exception 'table % not found or not cleaning', p_table_id;
  end if;

  return v_row;
end;
$$;

revoke all on function public.notify_table_cleaning(uuid) from public;
grant execute on function public.notify_table_cleaning(uuid) to anon, authenticated;
