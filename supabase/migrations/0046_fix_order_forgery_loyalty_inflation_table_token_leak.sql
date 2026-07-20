-- 0046_fix_order_forgery_loyalty_inflation_table_token_leak.sql
-- Three more issues found in a full-webapp security review (2026-07-21):
--
-- 1) orders/order_items INSERT policies (0005) let a logged-in customer
--    directly forge a fully "completed, paid" order at any price via a
--    raw client insert, completely bypassing place_order's server-side
--    pricing/validation -- and that forged "completed" status then
--    unlocks submit_menu_item_review's verified-purchase check and
--    pollutes get_dashboard_stats()/shift reports with fake revenue.
--    Nothing in the client ever inserts into these tables directly
--    (place_order is the only real path -- confirmed via a full grep
--    of lib/ and components/), so the customer branch of these
--    policies has no legitimate use and is pure attack surface.
--
-- 2) profiles_update_own lets a customer directly self-inflate their
--    own loyalty_points_balance via a raw client update (no client
--    code does this either -- the only client reference to this
--    column is a read in lib/supabase/loyalty-data.ts). Column-level
--    REVOKE closes this without affecting any RPC (place_order,
--    redeem_reward, handle_order_paid), which all run as the function
--    owner regardless of this grant.
--
-- 3) tables.qr_code_token was broadly SELECT-able by anon/authenticated
--    via the tables_select_all `using (true)` policy plus the default
--    table-level SELECT grant -- and was actually being fetched in
--    full for every table, on every single page load, by the app-wide
--    TablesProvider (mounted in the root layout for the dine-in
--    "active table" feature). This defeated the physical-QR-scan
--    assumption entirely: any visitor could read every table's secret
--    token with zero interaction. Column-level REVOKE closes the
--    direct-query path; two new RPCs replace the two legitimate needs
--    (guest self-service token lookup, admin QR display/print);
--    regenerate_table_qr_token is converted from SECURITY INVOKER to
--    SECURITY DEFINER (with an explicit internal role check) since its
--    RETURNING clause needed SELECT on this column for the calling
--    role, which the REVOKE now removes; the supabase_realtime
--    publication is also narrowed to stop broadcasting this column to
--    every subscriber regardless of the column-level REVOKE (Realtime
--    respects RLS row-visibility but not column grants).

-- --- Fix 1: orders/order_items direct-insert forgery ---
drop policy "orders_insert" on public.orders;
create policy "orders_insert" on public.orders for insert
  with check (public.current_user_role() in ('staff', 'manager', 'admin'));

drop policy "order_items_insert" on public.order_items;
create policy "order_items_insert" on public.order_items for insert
  with check (exists (
    select 1 from public.orders o where o.id = order_items.order_id
    and public.current_user_role() in ('staff', 'manager', 'admin')
  ));

-- --- Fix 2: loyalty_points_balance self-inflation ---
revoke update (loyalty_points_balance) on public.profiles from anon, authenticated;

-- --- Fix 3: tables.qr_code_token broad exposure ---
revoke select (qr_code_token) on public.tables from anon, authenticated;

create or replace function public.get_table_by_qr_token(p_token text)
returns public.tables
language sql
stable
security definer
set search_path = public
as $$
  select * from public.tables where qr_code_token = p_token;
$$;
grant execute on function public.get_table_by_qr_token(text) to anon, authenticated;

create or replace function public.get_tables_admin()
returns setof public.tables
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() not in ('staff', 'manager', 'admin') then
    raise exception 'not_authorized';
  end if;
  return query select * from public.tables order by table_number;
end;
$$;
grant execute on function public.get_tables_admin() to authenticated;
revoke execute on function public.get_tables_admin() from anon;

create or replace function public.regenerate_table_qr_token(p_table_id uuid)
returns public.tables
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.tables;
begin
  if public.current_user_role() not in ('staff', 'manager', 'admin') then
    raise exception 'not_authorized';
  end if;

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

alter publication supabase_realtime drop table public.tables;
alter publication supabase_realtime add table public.tables
  (id, table_number, location_vi, location_en, status, cleaning_notified_at, scan_count);
