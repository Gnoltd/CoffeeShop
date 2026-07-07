-- 0020_menu_item_size_toggle.sql
-- Admin-configurable "has size options" toggle per menu item — some
-- products (e.g. a single-size pastry) should never show a size picker
-- regardless of how many menu_item_sizes rows happen to exist for them.
-- Defaults to true so every existing item's current behavior is
-- unchanged on launch.

alter table public.menu_items add column has_size_options boolean not null default true;
