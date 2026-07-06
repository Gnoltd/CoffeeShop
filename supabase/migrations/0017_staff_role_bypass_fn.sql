-- 0017_staff_role_bypass_fn.sql
-- Found live: create-staff-account's service-role client bypasses RLS
-- but NOT the on_profile_role_change trigger (migration 0001) — triggers
-- fire regardless of RLS bypass, and the trigger's own
-- current_user_role() check resolves auth.uid() as null for a
-- service-role connection with no forwarded JWT, so it correctly (from
-- its own perspective) blocked the very first role assignment on a
-- brand-new account. Adds a narrowly-scoped function, grantable only to
-- service_role (never authenticated/anon — it has no authorization
-- check of its own, relying entirely on only the already-admin-gated
-- Edge Function being able to call it), that uses
-- session_replication_role to skip triggers for just this one
-- statement.

create or replace function public.set_initial_staff_role(p_user_id uuid, p_role user_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  set local session_replication_role = replica;
  update public.profiles set role = p_role where id = p_user_id;
  set local session_replication_role = origin;
end;
$$;

revoke all on function public.set_initial_staff_role(uuid, user_role) from public;
grant execute on function public.set_initial_staff_role(uuid, user_role) to service_role;
