-- 0015_orders_realtime_publication.sql
-- Migration 0014 added the place_order/get_order_for_tracking RPCs but
-- missed adding orders to the supabase_realtime publication (unlike the
-- Inventory/Tables sub-projects, which each did this in their own
-- migration) — found live via Playwright when neither the customer
-- tracking page nor Kitchen Display picked up a real status change
-- without a manual refresh.

alter publication supabase_realtime add table public.orders;
