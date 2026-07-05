-- 0009_seed_menu_data.sql
-- Seeds today's mock menu (lib/mock-data/menu.ts) as real rows. Retires
-- that file as a live data source — see Task 10.

insert into public.categories (name_vi, name_en, sort_order) values
  ('Cà Phê', 'Coffee', 0),
  ('Trà', 'Tea', 1),
  ('Bánh Ngọt', 'Pastries', 2),
  ('Đá Xay', 'Blended', 3);

with cat as (
  select id, name_en from public.categories
),
new_items as (
  insert into public.menu_items
    (category_id, name_vi, name_en, description_vi, description_en, base_price, icon, is_available, is_popular)
  select c.id, v.name_vi, v.name_en, v.description_vi, v.description_en, v.base_price, v.icon, v.is_available, v.is_popular
  from (values
    ('Coffee', 'Phin Sữa Đá', 'Iced Milk Coffee', 'Cà phê phin truyền thống hòa quyện cùng sữa đặc béo ngậy.', 'Authentic drip coffee with condensed milk.', 29000, 'coffee', true, true),
    ('Coffee', 'Cà Phê Đen', 'Black Coffee', 'Đậm đà hương vị truyền thống.', 'Strong and bold traditional taste.', 25000, 'coffee', true, false),
    ('Coffee', 'Cà Phê Trứng', 'Egg Coffee', 'Hương vị Hà Nội nồng nàn.', 'Signature Hanoi creamy egg foam.', 45000, 'coffee', true, true),
    ('Coffee', 'Bạc Xỉu', 'White Coffee', 'Nhiều sữa ít cà phê.', 'Milk-forward coffee delight.', 32000, 'milk', false, false),
    ('Tea', 'Trà Sen Vàng', 'Golden Lotus Tea', 'Thanh mát hương sen tự nhiên.', 'Refreshing natural lotus fragrance.', 39000, 'cup-soda', true, false),
    ('Tea', 'Trà Vải', 'Lychee Tea', 'Vị ngọt trái cây tươi mát.', 'Sweet, refreshing fruit flavor.', 35000, 'cup-soda', true, false),
    ('Pastries', 'Bánh Mì Que', 'Crispy Breadsticks', 'Giòn rụm, dùng kèm pate.', 'Crispy breadsticks served with pate.', 19000, 'cookie', true, false),
    ('Pastries', 'Bánh Croissant Bơ', 'Butter Croissant', 'Lớp vỏ giòn tan, thơm bơ.', 'Flaky, buttery layers.', 28000, 'cookie', true, false),
    ('Blended', 'Cà Phê Đá Xay', 'Coffee Frappe', 'Mát lạnh, sánh mịn.', 'Cold, smooth, and creamy.', 42000, 'cup-soda', true, true)
  ) as v(cat_name_en, name_vi, name_en, description_vi, description_en, base_price, icon, is_available, is_popular)
  join cat c on c.name_en = v.cat_name_en
  returning id, name_en
)
select 1; -- CTE above is materialized for the inserts below via a second pass

-- Sizes apply to every item except Egg Coffee, Lychee Tea, Crispy
-- Breadsticks, and Butter Croissant (matches sizeOptions being omitted for
-- those items in the original mock data).
insert into public.menu_item_sizes (menu_item_id, name, price_delta)
select mi.id, s.name, s.price_delta
from public.menu_items mi
cross join (values ('S', -5000), ('M', 0), ('L', 8000)) as s(name, price_delta)
where mi.name_en in (
  'Iced Milk Coffee', 'Black Coffee', 'White Coffee',
  'Golden Lotus Tea', 'Coffee Frappe'
);

-- Milk modifier group, required, applies only to Iced Milk Coffee (the
-- only item with modifierGroups in the original mock data).
with grp as (
  insert into public.modifier_groups (name_vi, name_en, is_required, max_selections)
  values ('Lựa Chọn Sữa', 'Milk Options', true, 1)
  returning id
),
opts as (
  insert into public.modifiers (modifier_group_id, name_vi, name_en, price_delta)
  select grp.id, v.name_vi, v.name_en, v.price_delta
  from grp, (values
    ('Sữa Đặc', 'Condensed Milk', 0),
    ('Sữa Tươi', 'Fresh Milk', 5000)
  ) as v(name_vi, name_en, price_delta)
  returning modifier_group_id
)
insert into public.menu_item_modifier_groups (menu_item_id, modifier_group_id)
select mi.id, grp.id
from public.menu_items mi, grp
where mi.name_en = 'Iced Milk Coffee';
