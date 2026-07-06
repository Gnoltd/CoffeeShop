-- 0016_staff_active_and_directory_fn.sql
-- Adds a disable mechanism (is_active) that revokes staff/manager/admin
-- powers by downgrading current_user_role() to 'customer' — no separate
-- ban/logout mechanism needed, and a disabled employee keeps ordinary
-- customer access rather than being locked out entirely. Adds
-- get_staff_members(), the only controlled path that reads auth.users
-- (protected schema, not exposed to the client directly) to surface
-- each staff member's email. Adds profiles to the Realtime publication
-- (the step the Orders sub-project's migration forgot, found live).

alter table public.profiles add column is_active boolean not null default true;

create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select case when is_active then role else 'customer' end
  from public.profiles where id = auth.uid();
$$;

create or replace function public.get_staff_members()
returns table (
  id uuid,
  full_name text,
  phone text,
  role user_role,
  is_active boolean,
  email text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() not in ('staff', 'manager', 'admin') then
    raise exception 'not authorized';
  end if;

  return query
    select p.id, p.full_name, p.phone, p.role, p.is_active, u.email::text
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.role <> 'customer'
    order by p.created_at;
end;
$$;

grant execute on function public.get_staff_members() to authenticated;

alter publication supabase_realtime add table public.profiles;
