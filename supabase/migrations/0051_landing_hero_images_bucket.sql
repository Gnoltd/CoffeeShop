-- 0051_landing_hero_images_bucket.sql
-- Public Storage bucket for the landing page hero's admin-manageable
-- photos (3-photo crossfading background gallery + 1 spotlight-reveal
-- photo) -- see docs/superpowers/specs/2026-07-21-admin-editable-
-- landing-hero-design.md. Follows the same convention as
-- menu-item-images (0028, hardened in 0050): public read (the landing
-- page is guest-facing), manager/admin write, MIME/size restrictions
-- enforced server-side at the bucket level, not just client-side.

insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values (
  'landing-hero-images',
  'landing-hero-images',
  true,
  array['image/jpeg', 'image/png', 'image/webp'],
  8388608
)
on conflict (id) do nothing;

create policy "landing_hero_images_public_read" on storage.objects
  for select using (bucket_id = 'landing-hero-images');

create policy "landing_hero_images_admin_insert" on storage.objects
  for insert with check (
    bucket_id = 'landing-hero-images'
    and public.current_user_role() in ('manager', 'admin')
  );

create policy "landing_hero_images_admin_update" on storage.objects
  for update using (
    bucket_id = 'landing-hero-images'
    and public.current_user_role() in ('manager', 'admin')
  );

create policy "landing_hero_images_admin_delete" on storage.objects
  for delete using (
    bucket_id = 'landing-hero-images'
    and public.current_user_role() in ('manager', 'admin')
  );
