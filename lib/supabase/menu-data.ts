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

type CategoryRow = {
  id: string
  name_vi: string
  name_en: string
  sort_order: number
}

export async function getCategories(supabase: SupabaseClient): Promise<MenuCategory[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name_vi, name_en, sort_order")
    .order("sort_order")
  if (error) throw error
  return ((data ?? []) as CategoryRow[]).map((row) => ({
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

type SizeRow = {
  id: string
  name: string
  price_delta: number
}

type ModifierRow = {
  id: string
  name_vi: string
  name_en: string
  price_delta: number
}

type ModifierGroupRow = {
  id: string
  name_vi: string
  name_en: string
  is_required: boolean
  modifiers: ModifierRow[] | null
}

type ModifierGroupLinkRow = {
  modifier_groups: ModifierGroupRow
}

type MenuItemRow = {
  id: string
  category_id: string
  name_vi: string
  name_en: string
  description_vi: string
  description_en: string
  base_price: number
  icon: MenuIcon
  is_available: boolean
  is_popular: boolean
  image_url: string | null
  menu_item_sizes: SizeRow[] | null
  menu_item_modifier_groups: ModifierGroupLinkRow[] | null
}

function mapMenuItemRow(row: MenuItemRow): MenuItem {
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
    sizes: (row.menu_item_sizes ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      priceDelta: s.price_delta,
    })),
    modifierGroups: (row.menu_item_modifier_groups ?? []).map((link) => ({
      id: link.modifier_groups.id,
      nameVi: link.modifier_groups.name_vi,
      nameEn: link.modifier_groups.name_en,
      required: link.modifier_groups.is_required,
      options: (link.modifier_groups.modifiers ?? []).map((m) => ({
        id: m.id,
        nameVi: m.name_vi,
        nameEn: m.name_en,
        priceDelta: m.price_delta,
      })),
    })),
  }
}

export async function getMenuItems(supabase: SupabaseClient): Promise<MenuItem[]> {
  const { data, error } = await supabase.from("menu_items").select(MENU_ITEM_SELECT).order("name_en")
  if (error) throw error
  return ((data ?? []) as unknown as MenuItemRow[]).map(mapMenuItemRow)
}

export async function getMenuItemById(supabase: SupabaseClient, id: string): Promise<MenuItem | null> {
  const { data, error } = await supabase
    .from("menu_items")
    .select(MENU_ITEM_SELECT)
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  return data ? mapMenuItemRow(data as unknown as MenuItemRow) : null
}

function toRow(input: MenuItemInput) {
  return {
    category_id: input.categoryId,
    name_vi: input.nameVi,
    name_en: input.nameEn,
    description_vi: input.descriptionVi,
    description_en: input.descriptionEn,
    base_price: input.basePrice,
    icon: input.icon,
    is_available: input.isAvailable,
    is_popular: input.isPopular,
    image_url: input.imageUrl ?? null,
  }
}

export async function createMenuItem(supabase: SupabaseClient, input: MenuItemInput): Promise<MenuItem> {
  const { data, error } = await supabase
    .from("menu_items")
    .insert(toRow(input))
    .select(MENU_ITEM_SELECT)
    .single()
  if (error) throw error
  return mapMenuItemRow(data as unknown as MenuItemRow)
}

export async function updateMenuItem(
  supabase: SupabaseClient,
  id: string,
  input: MenuItemInput
): Promise<MenuItem> {
  const { data, error } = await supabase
    .from("menu_items")
    .update(toRow(input))
    .eq("id", id)
    .select(MENU_ITEM_SELECT)
    .single()
  if (error) throw error
  return mapMenuItemRow(data as unknown as MenuItemRow)
}

export async function deleteMenuItem(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("menu_items").delete().eq("id", id)
  if (error) throw error
}

export async function getModifierGroups(supabase: SupabaseClient): Promise<MenuModifierGroup[]> {
  const { data, error } = await supabase
    .from("modifier_groups")
    .select("id, name_vi, name_en, is_required, modifiers ( id, name_vi, name_en, price_delta )")
    .order("name_en")
  if (error) throw error
  return ((data ?? []) as unknown as ModifierGroupRow[]).map((row) => ({
    id: row.id,
    nameVi: row.name_vi,
    nameEn: row.name_en,
    required: row.is_required,
    options: (row.modifiers ?? []).map((m) => ({
      id: m.id,
      nameVi: m.name_vi,
      nameEn: m.name_en,
      priceDelta: m.price_delta,
    })),
  }))
}

export type ModifierGroupInput = {
  nameVi: string
  nameEn: string
  priceDelta: number
}

export async function createModifierGroup(
  supabase: SupabaseClient,
  input: ModifierGroupInput
): Promise<MenuModifierGroup> {
  const { data: groupRow, error: groupError } = await supabase
    .from("modifier_groups")
    .insert({ name_vi: input.nameVi, name_en: input.nameEn, is_required: false, max_selections: 1 })
    .select("id, name_vi, name_en, is_required")
    .single()
  if (groupError) throw groupError

  const { data: modifierRow, error: modifierError } = await supabase
    .from("modifiers")
    .insert({
      modifier_group_id: groupRow.id,
      name_vi: input.nameVi,
      name_en: input.nameEn,
      price_delta: input.priceDelta,
    })
    .select("id, name_vi, name_en, price_delta")
    .single()
  if (modifierError) throw modifierError

  return {
    id: groupRow.id,
    nameVi: groupRow.name_vi,
    nameEn: groupRow.name_en,
    required: groupRow.is_required,
    options: [
      {
        id: modifierRow.id,
        nameVi: modifierRow.name_vi,
        nameEn: modifierRow.name_en,
        priceDelta: modifierRow.price_delta,
      },
    ],
  }
}

export async function setItemModifierGroups(
  supabase: SupabaseClient,
  itemId: string,
  groupIds: string[]
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("menu_item_modifier_groups")
    .delete()
    .eq("menu_item_id", itemId)
  if (deleteError) throw deleteError

  if (groupIds.length === 0) return

  const { error: insertError } = await supabase
    .from("menu_item_modifier_groups")
    .insert(groupIds.map((groupId) => ({ menu_item_id: itemId, modifier_group_id: groupId })))
  if (insertError) throw insertError
}
