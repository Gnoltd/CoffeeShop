-- 0011_seed_inventory_data.sql
-- Seeds the 4 ingredients already on screen in the mock Inventory page
-- (hooks/useInventory.tsx's INITIAL_INGREDIENTS) as real rows, so Admin
-- Inventory/Dashboard show identical content once the query layer swap
-- (Task 5) lands. Stock is set via adjust_ingredient_stock, not a raw
-- insert value, so the very first stock number is logged like every
-- later change will be.

do $$
declare
  v_id uuid;
begin
  insert into public.ingredients (name_vi, name_en, subtitle_vi, subtitle_en, unit, low_stock_threshold, icon)
    values ('Hạt Robusta Đặc Sản', 'Coffee Beans (Roasted)', 'Nguyên liệu', 'Raw material', 'kg', 10, 'coffee')
    returning id into v_id;
  perform public.adjust_ingredient_stock(v_id, 5.2, 'adjustment');

  insert into public.ingredients (name_vi, name_en, subtitle_vi, subtitle_en, unit, low_stock_threshold, icon)
    values ('Sữa Đặc Ông Thọ', 'Condensed Milk', 'Hàng tiêu dùng', 'Consumable', 'lon / cans', 12, 'droplet')
    returning id into v_id;
  perform public.adjust_ingredient_stock(v_id, 24, 'adjustment');

  insert into public.ingredients (name_vi, name_en, subtitle_vi, subtitle_en, unit, low_stock_threshold, icon)
    values ('Bột Kem Béo', 'Creamer Powder', 'Nguyên liệu', 'Raw material', 'kg', 5, 'wheat')
    returning id into v_id;
  perform public.adjust_ingredient_stock(v_id, 8.5, 'adjustment');

  insert into public.ingredients (name_vi, name_en, subtitle_vi, subtitle_en, unit, low_stock_threshold, icon)
    values ('Đường Cát Trắng', 'White Sugar', 'Nguyên liệu', 'Raw material', 'kg', 15, 'candy')
    returning id into v_id;
  perform public.adjust_ingredient_stock(v_id, 2.1, 'adjustment');
end $$;
