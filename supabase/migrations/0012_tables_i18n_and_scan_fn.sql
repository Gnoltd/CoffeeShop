-- 0012_tables_i18n_and_scan_fn.sql
-- Bilingual location + occupied + scan-count columns on tables
-- (previously mock-only fields with no real columns), a guest-writable
-- scan-count RPC (security definer — a QR-scanning customer has no role
-- and would otherwise be blocked by tables_admin_all), an admin-only
-- QR-token-regeneration RPC (security invoker, matching
-- adjust_ingredient_stock's reasoning), and Realtime replication.

alter table public.tables add column location_vi text not null default '';
alter table public.tables add column location_en text not null default '';
alter table public.tables add column is_occupied boolean not null default false;
alter table public.tables add column scan_count integer not null default 0;

create or replace function public.increment_table_scan_count(
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
    set scan_count = scan_count + 1
    where id = p_table_id
    returning * into v_row;

  if v_row.id is null then
    raise exception 'table % not found', p_table_id;
  end if;

  return v_row;
end;
$$;

revoke all on function public.increment_table_scan_count(uuid) from public;
grant execute on function public.increment_table_scan_count(uuid) to anon, authenticated;

create or replace function public.regenerate_table_qr_token(
  p_table_id uuid
) returns public.tables
language plpgsql
security invoker
as $$
declare
  v_row public.tables;
begin
  update public.tables
    set qr_code_token = encode(gen_random_bytes(16), 'hex')
    where id = p_table_id
    returning * into v_row;

  if v_row.id is null then
    raise exception 'table % not found', p_table_id;
  end if;

  return v_row;
end;
$$;

grant execute on function public.regenerate_table_qr_token(uuid) to authenticated;

alter publication supabase_realtime add table public.tables;
