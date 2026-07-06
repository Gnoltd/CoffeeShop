-- 0010_inventory_i18n_and_stock_fn.sql
-- Bilingual name/subtitle + icon on ingredients (previously mock-only
-- fields with no real columns), an atomic stock-adjustment RPC (replaces
-- the old mock's client-side clamp-then-write, which was only safe with a
-- single browser tab), and Realtime replication for ingredients/
-- inventory_logs so every open admin session sees the same live state.

create type public.ingredient_icon as enum ('coffee', 'droplet', 'wheat', 'candy');

alter table public.ingredients add column name_vi text not null default '';
alter table public.ingredients add column name_en text not null default '';
alter table public.ingredients alter column name_vi drop default;
alter table public.ingredients alter column name_en drop default;

alter table public.ingredients add column subtitle_vi text not null default '';
alter table public.ingredients add column subtitle_en text not null default '';
alter table public.ingredients alter column subtitle_vi drop default;
alter table public.ingredients alter column subtitle_en drop default;

alter table public.ingredients add column icon public.ingredient_icon not null default 'coffee';

alter table public.ingredients drop column name;

create or replace function public.adjust_ingredient_stock(
  p_ingredient_id uuid,
  p_change numeric,
  p_reason inventory_log_reason
) returns public.ingredients
language plpgsql
security invoker
as $$
declare
  v_current numeric;
  v_clamped_change numeric;
  v_row public.ingredients;
begin
  select stock_quantity into v_current
    from public.ingredients
    where id = p_ingredient_id
    for update;

  if v_current is null then
    raise exception 'ingredient % not found', p_ingredient_id;
  end if;

  v_clamped_change := greatest(p_change, -v_current);

  update public.ingredients
    set stock_quantity = round(stock_quantity + v_clamped_change, 2)
    where id = p_ingredient_id
    returning * into v_row;

  insert into public.inventory_logs (ingredient_id, change_quantity, reason, created_by)
    values (p_ingredient_id, v_clamped_change, p_reason, auth.uid());

  return v_row;
end;
$$;

grant execute on function public.adjust_ingredient_stock(uuid, numeric, inventory_log_reason) to authenticated;

alter publication supabase_realtime add table public.ingredients;
alter publication supabase_realtime add table public.inventory_logs;
