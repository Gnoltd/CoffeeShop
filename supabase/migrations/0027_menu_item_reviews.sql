-- 0027_menu_item_reviews.sql
-- Real verified-purchase reviews, replacing lib/mock-data/reviews.ts.
-- All writes go through security definer RPCs (never raw RLS grants) so
-- "verified purchase" and "manager/admin only reply" are enforced
-- server-side, matching every other privileged mutation in this project
-- (place_order, adjust_ingredient_stock, etc.). Reads are public (guest-
-- browsable /menu) via a security definer RPC too, since resolving the
-- reviewer's display name requires reading public.profiles, which plain
-- RLS (profiles_select_own/profiles_select_staff) would block for any
-- viewer who isn't that reviewer or staff.

create table public.menu_item_reviews (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null,
  staff_reply text,
  staff_reply_at timestamptz,
  replied_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (menu_item_id, customer_id)
);

alter table public.menu_item_reviews enable row level security;

create policy "menu_item_reviews_select_all" on public.menu_item_reviews
  for select using (true);

-- No insert/update/delete policies: every write goes through the two
-- RPCs below, which run as security definer.

create or replace function public.submit_menu_item_review(
  p_item_id uuid,
  p_rating smallint,
  p_comment text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_purchase boolean;
begin
  if p_rating < 1 or p_rating > 5 then
    raise exception 'rating must be between 1 and 5';
  end if;

  select exists (
    select 1
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.menu_item_id = p_item_id
      and o.customer_id = auth.uid()
      and o.status = 'completed'
  ) into v_has_purchase;

  if not v_has_purchase then
    raise exception 'only customers with a completed order for this item can review it';
  end if;

  insert into public.menu_item_reviews (menu_item_id, customer_id, rating, comment)
  values (p_item_id, auth.uid(), p_rating, p_comment)
  on conflict (menu_item_id, customer_id)
  do update set rating = excluded.rating, comment = excluded.comment, updated_at = now();
end;
$$;

grant execute on function public.submit_menu_item_review(uuid, smallint, text) to authenticated;

create or replace function public.reply_to_review(
  p_review_id uuid,
  p_reply text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() not in ('manager', 'admin') then
    raise exception 'only manager/admin can reply to reviews';
  end if;

  update public.menu_item_reviews
  set staff_reply = p_reply, staff_reply_at = now(), replied_by = auth.uid()
  where id = p_review_id;
end;
$$;

grant execute on function public.reply_to_review(uuid, text) to authenticated;

create or replace function public.get_menu_item_reviews(p_item_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reviews json;
  v_avg numeric;
  v_count int;
begin
  select coalesce(avg(rating), 0), count(*) into v_avg, v_count
  from public.menu_item_reviews where menu_item_id = p_item_id;

  select coalesce(json_agg(row_to_json(r) order by r.created_at desc), '[]'::json) into v_reviews
  from (
    select
      mir.id,
      p.full_name as reviewer_name,
      mir.rating,
      mir.comment,
      mir.staff_reply,
      mir.staff_reply_at,
      mir.created_at
    from public.menu_item_reviews mir
    join public.profiles p on p.id = mir.customer_id
    where mir.menu_item_id = p_item_id
  ) r;

  return json_build_object('reviews', v_reviews, 'avgRating', v_avg, 'reviewCount', v_count);
end;
$$;

grant execute on function public.get_menu_item_reviews(uuid) to anon, authenticated;
