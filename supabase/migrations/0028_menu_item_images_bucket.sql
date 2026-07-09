-- 0028_menu_item_images_bucket.sql
-- Public Storage bucket backing real menu item photo uploads (previously
-- admin-uploaded images were discarded entirely -- see menu-item-form.tsx's
-- blob-URL-only preview bug). Public read since /menu is guest-browsable;
-- write restricted to manager/admin, mirroring every other admin-only
-- mutation's role check via current_user_role().

insert into storage.buckets (id, name, public)
values ('menu-item-images', 'menu-item-images', true)
on conflict (id) do nothing;

create policy "menu_item_images_public_read" on storage.objects
  for select using (bucket_id = 'menu-item-images');

create policy "menu_item_images_admin_insert" on storage.objects
  for insert with check (
    bucket_id = 'menu-item-images'
    and public.current_user_role() in ('manager', 'admin')
  );

create policy "menu_item_images_admin_update" on storage.objects
  for update using (
    bucket_id = 'menu-item-images'
    and public.current_user_role() in ('manager', 'admin')
  );

create policy "menu_item_images_admin_delete" on storage.objects
  for delete using (
    bucket_id = 'menu-item-images'
    and public.current_user_role() in ('manager', 'admin')
  );
