-- 0050_menu_item_images_bucket_restrictions.sql
-- Long-term Storage hardening (2026-07-21): menu-item-images had no
-- server-side file-type/size enforcement at all -- menu-item-form.tsx's
-- `image/*` + 5MB checks in selectFile() are client-side only, so any
-- manager/admin session (the only role with write access per 0028's
-- RLS) could upload arbitrary content -- an HTML file, an SVG with
-- embedded script, a 50MB video -- and have it served publicly from
-- this public-read bucket. Setting allowed_mime_types/file_size_limit
-- directly on the bucket makes Storage itself reject anything that
-- isn't actually an image, regardless of what the client sends,
-- closing the gap without any app-code change.
--
-- Establishes the pattern going forward for any future bucket (see the
-- new "Storage buckets" section in supabase/CLAUDE.md): every bucket
-- sets these two columns at creation, no exceptions.

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    file_size_limit = 5242880 -- 5MB, matching menu-item-form.tsx's existing client-side check
where id = 'menu-item-images';
