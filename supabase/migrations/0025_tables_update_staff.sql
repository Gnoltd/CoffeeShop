-- 0025_tables_update_staff.sql
-- Fixes a real bug found live: KDS's Tables column (accessible to
-- plain `staff` role, per middleware's /staff/* gating) exposes a
-- "Cleaning Done" action that writes directly to public.tables, but
-- tables_admin_all (migration 0005) only grants UPDATE to
-- manager/admin. Staff taps silently did nothing -- RLS rejected the
-- write and kitchen-tables-column.tsx had no error handling to surface
-- it. Adds a staff UPDATE policy, mirroring orders_update_staff's
-- existing broad-grant-narrow-UI precedent (staff-facing UI never
-- exposes rename/QR-regenerate actions anyway -- those only exist on
-- /admin/tables, unreachable by staff via middleware).

create policy "tables_update_staff" on public.tables for update
  using (public.current_user_role() in ('staff', 'manager', 'admin'))
  with check (public.current_user_role() in ('staff', 'manager', 'admin'));
