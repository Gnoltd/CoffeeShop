-- 0039_customer_addresses.sql
-- Real customer address book, replacing Profile's disabled+tooltip
-- "Addresses" row ("Not implemented yet — no addresses table"). This
-- app has no delivery order_type (pickup | dine_in only) — this is a
-- personal address book only, not wired into checkout.

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id),
  label text not null,
  address text not null,
  phone text not null default '',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.customer_addresses enable row level security;

create policy "customer_addresses_select_own" on public.customer_addresses for select
  using (customer_id = auth.uid());
create policy "customer_addresses_insert_own" on public.customer_addresses for insert
  with check (customer_id = auth.uid());
create policy "customer_addresses_update_own" on public.customer_addresses for update
  using (customer_id = auth.uid()) with check (customer_id = auth.uid());
create policy "customer_addresses_delete_own" on public.customer_addresses for delete
  using (customer_id = auth.uid());

create index idx_customer_addresses_customer_id on public.customer_addresses (customer_id);

-- security invoker: RLS already scopes both updates to the caller's own
-- rows; this just guarantees at most one is_default=true at a time.
create or replace function public.set_default_address(p_address_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.customer_addresses set is_default = false where customer_id = auth.uid();
  update public.customer_addresses set is_default = true where id = p_address_id and customer_id = auth.uid();
end;
$$;

grant execute on function public.set_default_address(uuid) to authenticated;
