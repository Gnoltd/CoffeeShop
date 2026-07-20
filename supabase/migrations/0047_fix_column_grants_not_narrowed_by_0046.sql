-- 0047_fix_column_grants_not_narrowed_by_0046.sql
-- 0046 tried to close two column-level exposures with
-- `revoke select/update (column) on table from anon, authenticated`,
-- but that doesn't work the way it looks like it should: this project's
-- tables have a blanket table-level GRANT (covering every column) to
-- anon/authenticated, and a table-level grant is a separate ACL from
-- any column-level entry -- revoking a privilege at the column level
-- only removes a column-level grant if one exists; it cannot narrow an
-- already-broader table-level grant, which still applies regardless.
-- Verified live: after 0046, `information_schema.column_privileges` and
-- `pg_attribute.attacl` both showed the revoke had no effect at all.
--
-- The correct fix is to revoke the blanket table-level privilege
-- entirely, then re-grant only the safe columns -- which is what this
-- migration does for both cases 0046 was trying to fix:
--   - public.profiles: UPDATE narrowed to exclude loyalty_points_balance
--     (role/is_active stay grantable -- they're correctly protected by
--     the prevent_role_self_change trigger instead, which can tell an
--     admin's own direct update apart from a customer's, something a
--     Postgres-role-level column grant cannot do, since admin and
--     customer are both just "authenticated" at the database level).
--   - public.tables: SELECT narrowed to exclude qr_code_token.
--
-- Also re-revoking get_tables_admin()'s anon EXECUTE here (in its own
-- migration, separate from the CREATE FUNCTION that defined it in
-- 0046) -- the same live check showed anon could still execute it
-- after 0046, matching the exact pattern already seen once before with
-- set_initial_staff_role (0017/0045): this project's default
-- privileges appear to (re-)grant EXECUTE to anon/authenticated at
-- CREATE FUNCTION time in a way that isn't undone by a REVOKE issued
-- later in the very same migration, but IS undone by a REVOKE issued
-- in a separate, later migration (confirmed working for
-- set_initial_staff_role in 0045). Noting this pattern here for future
-- migrations: always revoke a function's default anon/authenticated
-- EXECUTE in a follow-up migration, never in the same one that creates
-- the function.

revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone, avatar_url, role, is_active) on public.profiles to authenticated;

revoke select on public.tables from anon, authenticated;
grant select (id, table_number, location_vi, location_en, status, cleaning_notified_at, scan_count)
  on public.tables to anon, authenticated;

revoke execute on function public.get_tables_admin() from anon;
