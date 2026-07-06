-- 0018_cancel_pending_order_fn.sql
-- Stripe follow-up: lets a customer self-cancel their own still-pending
-- order (e.g. backing out of Stripe Checkout) without waiting for the
-- checkout.session.expired webhook's 30-minute timeout. Mirrors
-- get_order_for_tracking's guest-safe pattern (migration 0014) — a
-- single-row operation keyed by an unguessable UUID, never a broad RLS
-- policy that could let one guest affect another guest's order.

create or replace function public.cancel_pending_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
begin
  select customer_id into v_customer_id from public.orders
    where id = p_order_id and status = 'pending_payment';

  if not found then
    return false;
  end if;

  if v_customer_id is not null and v_customer_id != auth.uid() then
    raise exception 'not authorized to cancel this order';
  end if;

  update public.orders set status = 'cancelled' where id = p_order_id;
  return true;
end;
$$;

grant execute on function public.cancel_pending_order(uuid) to anon, authenticated;
