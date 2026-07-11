-- 0037_menu_hot_path_indexes.sql
-- Performance fix: /menu and / (landing) were measured at ~600-800ms
-- slower TTFB than auth-only pages, traced to get_advisors flagging
-- several unindexed foreign keys on the exact tables joined by
-- getMenuItems' nested select (menu_items -> menu_item_sizes,
-- menu_item_modifier_groups). Paired with lib/supabase/menu-data-cached.ts's
-- 20s cache for the actual fix; these indexes also help admin-side
-- writes/joins on the same tables.

create index if not exists idx_menu_items_category_id on public.menu_items (category_id);
create index if not exists idx_menu_item_sizes_menu_item_id on public.menu_item_sizes (menu_item_id);
create index if not exists idx_menu_item_modifier_groups_modifier_group_id on public.menu_item_modifier_groups (modifier_group_id);
create index if not exists idx_order_items_menu_item_id on public.order_items (menu_item_id);
