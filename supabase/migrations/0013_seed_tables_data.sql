-- 0013_seed_tables_data.sql
-- Seeds the 6 tables already on screen in the mock Admin Tables page
-- (hooks/useTables.tsx's old DEFAULT_TABLES) as real rows, so the page
-- shows the same content once the query layer swap lands. qr_code_token
-- uses the column's own random-hex default instead of the old mock's
-- readable "table-1".."table-6" tokens — a real opaque token is strictly
-- better and needs no special-casing.

insert into public.tables (table_number, location_vi, location_en, is_occupied)
values
  ('1', 'Khu vực cửa sổ', 'Window Area', false),
  ('2', 'Khu trung tâm', 'Center Hall', true),
  ('3', 'Tầng 1 - Ban công', 'Floor 1 - Balcony', false),
  ('4', 'Tầng 1 - Trong nhà', 'Floor 1 - Indoor', false),
  ('5', 'Khu vực Bar', 'Bar Area', false),
  ('6', 'Sân vườn', 'Garden', false);
