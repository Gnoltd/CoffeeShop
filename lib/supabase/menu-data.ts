import type { SupabaseClient } from "@supabase/supabase-js"

export type MenuIcon = "coffee" | "cup-soda" | "cookie" | "milk"

export type MenuCategory = {
  id: string
  nameVi: string
  nameEn: string
  sortOrder: number
}

export type MenuItemSize = {
  id: string
  name: string
  priceDelta: number
}

export type MenuModifierOption = {
  id: string
  nameVi: string
  nameEn: string
  priceDelta: number
}

export type MenuModifierGroup = {
  id: string
  nameVi: string
  nameEn: string
  required: boolean
  options: MenuModifierOption[]
}

export type MenuItem = {
  id: string
  categoryId: string
  nameVi: string
  nameEn: string
  descriptionVi: string
  descriptionEn: string
  basePrice: number
  icon: MenuIcon
  isAvailable: boolean
  isPopular: boolean
  imageUrl: string | null
  sizes: MenuItemSize[]
  modifierGroups: MenuModifierGroup[]
}

export type MenuItemInput = {
  categoryId: string
  nameVi: string
  nameEn: string
  descriptionVi: string
  descriptionEn: string
  basePrice: number
  icon: MenuIcon
  isAvailable: boolean
  isPopular: boolean
  imageUrl?: string | null
}

export async function getCategories(supabase: SupabaseClient): Promise<MenuCategory[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name_vi, name_en, sort_order")
    .order("sort_order")
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    id: row.id,
    nameVi: row.name_vi,
    nameEn: row.name_en,
    sortOrder: row.sort_order,
  }))
}

const MENU_ITEM_SELECT = `
  id, category_id, name_vi, name_en, description_vi, description_en,
  base_price, icon, is_available, is_popular, image_url,
  menu_item_sizes ( id, name, price_delta ),
  menu_item_modifier_groups (
    modifier_groups ( id, name_vi, name_en, is_required, modifiers ( id, name_vi, name_en, price_delta ) )
  )
`

function mapMenuItemRow(row: any): MenuItem {
  return {
    id: row.id,
    categoryId: row.category_id,
    nameVi: row.name_vi,
    nameEn: row.name_en,
    descriptionVi: row.description_vi,
    descriptionEn: row.description_en,
    basePrice: row.base_price,
    icon: row.icon,
    isAvailable: row.is_available,
    isPopular: row.is_popular,
    imageUrl: row.image_url,
    sizes: (row.menu_item_sizes ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      priceDelta: s.price_delta,
    })),
    modifierGroups: (row.menu_item_modifier_groups ?? []).map((link: any) => ({
      id: link.modifier_groups.id,
      nameVi: link.modifier_groups.name_vi,
      nameEn: link.modifier_groups.name_en,
      required: link.modifier_groups.is_required,
      options: (link.modifier_groups.modifiers ?? []).map((m: any) => ({
        id: m.id,
        nameVi: m.name_vi,
        nameEn: m.name_en,
        priceDelta: m.price_delta,
      })),
    })),
  }
}

export async function getMenuItems(supabase: SupabaseClient): Promise<MenuItem[]> {
  const { data, error } = await supabase.from("menu_items").select(MENU_ITEM_SELECT)
  if (error) throw error
  return (data ?? []).map(mapMenuItemRow)
}

export async function getMenuItemById(supabase: SupabaseClient, id: string): Promise<MenuItem | null> {
  const { data, error } = await supabase
    .from("menu_items")
    .select(MENU_ITEM_SELECT)
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  return data ? mapMenuItemRow(data) : null
}
