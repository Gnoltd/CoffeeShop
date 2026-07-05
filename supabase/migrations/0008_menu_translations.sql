-- 0008_menu_translations.sql
-- Split single-language name/description columns into vi/en pairs, and add
-- icon + is_popular to menu_items (previously inferred client-side from
-- category, and hardcoded per-page respectively — both become real,
-- admin-editable columns instead).

alter table public.categories drop column name;
alter table public.categories add column name_vi text not null default '';
alter table public.categories add column name_en text not null default '';
alter table public.categories alter column name_vi drop default;
alter table public.categories alter column name_en drop default;

alter table public.menu_items drop column name;
alter table public.menu_items drop column description;
alter table public.menu_items add column name_vi text not null default '';
alter table public.menu_items add column name_en text not null default '';
alter table public.menu_items add column description_vi text not null default '';
alter table public.menu_items add column description_en text not null default '';
alter table public.menu_items alter column name_vi drop default;
alter table public.menu_items alter column name_en drop default;
alter table public.menu_items alter column description_vi drop default;
alter table public.menu_items alter column description_en drop default;

alter table public.menu_items add column icon text not null default 'coffee';
alter table public.menu_items add constraint menu_items_icon_check
  check (icon in ('coffee', 'cup-soda', 'cookie', 'milk'));
alter table public.menu_items add column is_popular boolean not null default false;

alter table public.modifier_groups drop column name;
alter table public.modifier_groups add column name_vi text not null default '';
alter table public.modifier_groups add column name_en text not null default '';
alter table public.modifier_groups alter column name_vi drop default;
alter table public.modifier_groups alter column name_en drop default;

alter table public.modifiers drop column name;
alter table public.modifiers add column name_vi text not null default '';
alter table public.modifiers add column name_en text not null default '';
alter table public.modifiers alter column name_vi drop default;
alter table public.modifiers alter column name_en drop default;
