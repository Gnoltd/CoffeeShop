-- payment_transactions, loyalty_transactions

create type payment_provider as enum ('stripe', 'vnpay', 'cash');
create type transaction_status as enum ('pending', 'succeeded', 'failed');

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider payment_provider not null,
  provider_transaction_id text,
  amount integer not null,
  status transaction_status not null default 'pending',
  raw_response jsonb,
  created_at timestamptz not null default now()
);
alter table public.payment_transactions enable row level security;

create type loyalty_transaction_type as enum ('earn', 'redeem', 'adjust');

create table public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id),
  order_id uuid references public.orders(id),
  points_change integer not null,
  type loyalty_transaction_type not null,
  created_at timestamptz not null default now()
);
alter table public.loyalty_transactions enable row level security;

create policy "payment_transactions_select_staff" on public.payment_transactions for select
  using (public.current_user_role() in ('staff', 'manager', 'admin'));
create policy "payment_transactions_admin_all" on public.payment_transactions for all
  using (public.current_user_role() in ('manager', 'admin'))
  with check (public.current_user_role() in ('manager', 'admin'));

create policy "loyalty_transactions_select_own" on public.loyalty_transactions for select
  using (customer_id = auth.uid());
create policy "loyalty_transactions_select_staff" on public.loyalty_transactions for select
  using (public.current_user_role() in ('staff', 'manager', 'admin'));
create policy "loyalty_transactions_admin_all" on public.loyalty_transactions for all
  using (public.current_user_role() in ('manager', 'admin'))
  with check (public.current_user_role() in ('manager', 'admin'));
