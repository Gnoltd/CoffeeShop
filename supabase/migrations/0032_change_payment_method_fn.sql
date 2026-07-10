-- 0032_change_payment_method_fn.sql
-- Guest-safe correction of a Pay Later payment-method choice.
-- Design: docs/superpowers/specs/2026-07-10-payment-method-correction-design.md
--
-- Only acts while status='served' AND payment_status='pending' -- the
-- one state where a recorded method is still safely changeable. p_method
-- null = reset to "no method chosen" (tracking page's 3-way picker
-- reappears; KDS card returns to Mark Cash). The UPDATE touches only
-- payment_method, so handle_order_paid /
-- complete_order_when_served_and_paid (gated on payment_status) can
-- never fire from it. Note: null here is a meaningful argument, not a
-- default-relying omission, so the PostgREST explicit-null gotcha
-- doesn't bite -- the function treats null itself.

create or replace function public.change_order_payment_method(
  p_order_id uuid,
  p_method payment_method default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  update public.orders
    set payment_method = p_method
    where id = p_order_id
      and status = 'served'
      and payment_status = 'pending';
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.change_order_payment_method(uuid, payment_method) from public;
grant execute on function public.change_order_payment_method(uuid, payment_method) to anon, authenticated;
