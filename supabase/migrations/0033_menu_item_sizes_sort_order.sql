-- 0033_menu_item_sizes_sort_order.sql
-- Lets the admin Sizes editor (see docs/superpowers/specs/2026-07-10-menu-item-sizes-editor-design.md)
-- control display order. Existing seeded rows all default to 0 (no prior
-- ordering signal exists to backfill from) -- self-heals the next time
-- an item's sizes are edited through the new UI.

alter table public.menu_item_sizes add column sort_order integer not null default 0;
