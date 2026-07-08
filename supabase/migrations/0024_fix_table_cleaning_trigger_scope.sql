-- 0024_fix_table_cleaning_trigger_scope.sql
-- Fixes a real bug found live: on_order_table_occupancy (migration
-- 0021) was scoped to `after update of status`, which only fires when
-- the *original* UPDATE statement explicitly targets the status
-- column. For a Pay Later order, once served, payment finalizing only
-- updates payment_status (e.g. stripe-webhook/vnpay-ipn/
-- confirmServedCashPayment) -- complete_order_when_served_and_paid
-- (migration 0022, a BEFORE trigger) correctly mutates NEW.status to
-- 'completed' as a side effect, but Postgres's column-scoped AFTER
-- trigger does not fire on that side effect, only on columns the
-- client's own UPDATE statement named. Net result: the order shows
-- completed/paid, but the table never moves to 'cleaning'.
--
-- Fix: drop the "OF status" column scope -- the function body already
-- correctly gates its own logic (checks new.status/old.status itself),
-- so firing on every UPDATE is safe and matches the unscoped pattern
-- already used by handle_order_paid and complete_order_when_served_and_paid.

drop trigger if exists on_order_table_occupancy on public.orders;
create trigger on_order_table_occupancy
  after insert or update on public.orders
  for each row
  execute function public.sync_table_occupancy();
