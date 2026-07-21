-- 0052_landing_hero_settings_columns.sql
-- Landing hero photos become admin-manageable instead of hardcoded in
-- spotlight-hero.tsx -- extends shop_settings (this project's existing
-- single-row shop-config table) rather than a new table, since this is
-- a fixed set of exactly 4 image slots, not a variable-length
-- collection. No new RLS needed: shop_settings_select_all (public read)
-- and shop_settings_update_admin (manager/admin write) are unscoped by
-- column, so they cover these new columns automatically.
--
-- Seeded with the CURRENT existing hero photo URLs (not new Stitch-
-- generated photography -- skipped for this pass per explicit user
-- decision) so the visual design stays unchanged at launch; an admin
-- can upload real distinct photos later through the new Settings card.
-- All 3 base-gallery slots get the same current base photo (no visible
-- crossfade variation until replaced) -- expected and fine for now.

alter table public.shop_settings
  add column landing_hero_base_images text[] not null default array[
    'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1600&q=80'
  ],
  add column landing_hero_reveal_image text
    default 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1600&q=80';
