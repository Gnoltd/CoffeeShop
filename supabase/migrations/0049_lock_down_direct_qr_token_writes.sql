-- 0049_lock_down_direct_qr_token_writes.sql
-- tables_update_staff (0025) has no column scoping, so any plain
-- `staff` account (not just manager/admin) could still directly
-- overwrite tables.qr_code_token via a raw client UPDATE -- 0046/0047
-- closed the *read* path (column-level SELECT revoke) but not this
-- write path, since UPDATE privilege on a column is independent of
-- SELECT privilege on it. Verified live:
-- has_column_privilege('authenticated', 'tables', 'qr_code_token',
-- 'update') returned true.
--
-- Closing this the same way as 0047: revoke the blanket column-level
-- UPDATE and re-grant only the columns any authenticated caller
-- legitimately writes directly (status, table_number, location_vi/en --
-- all still gated by tables_update_staff/tables_admin_all's role
-- check, unchanged). qr_code_token becomes writable only through
-- regenerate_table_qr_token, which is SECURITY DEFINER (bypasses this
-- grant entirely) and already has its own internal role check.

revoke update on public.tables from anon, authenticated;
grant update (status, table_number, location_vi, location_en) on public.tables to authenticated;
