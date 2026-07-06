import type { SupabaseClient } from "@supabase/supabase-js"

export type IngredientIcon = "coffee" | "droplet" | "wheat" | "candy"

export type Ingredient = {
  id: string
  nameVi: string
  nameEn: string
  subtitleVi: string
  subtitleEn: string
  unit: string
  stock: number
  threshold: number
  icon: IngredientIcon
}

export type IngredientInput = {
  nameVi: string
  nameEn: string
  subtitleVi: string
  subtitleEn: string
  unit: string
  threshold: number
  icon: IngredientIcon
}

export type InventoryLogReason = "restock" | "adjustment" | "waste" | "order_deduction"

export type InventoryLog = {
  id: string
  ingredientId: string
  ingredientNameVi: string
  ingredientNameEn: string
  change: number
  reason: InventoryLogReason
  timestamp: number
}

export type RecipeEntry = { ingredientId: string; quantityUsed: number }

const INGREDIENT_SELECT = "id, name_vi, name_en, subtitle_vi, subtitle_en, unit, stock_quantity, low_stock_threshold, icon"

export type IngredientRow = {
  id: string
  name_vi: string
  name_en: string
  subtitle_vi: string
  subtitle_en: string
  unit: string
  stock_quantity: number
  low_stock_threshold: number
  icon: IngredientIcon
}

export function mapIngredientRow(row: IngredientRow): Ingredient {
  return {
    id: row.id,
    nameVi: row.name_vi,
    nameEn: row.name_en,
    subtitleVi: row.subtitle_vi,
    subtitleEn: row.subtitle_en,
    unit: row.unit,
    stock: row.stock_quantity,
    threshold: row.low_stock_threshold,
    icon: row.icon,
  }
}

export async function getIngredients(supabase: SupabaseClient): Promise<Ingredient[]> {
  const { data, error } = await supabase.from("ingredients").select(INGREDIENT_SELECT).order("name_en")
  if (error) throw error
  return ((data ?? []) as IngredientRow[]).map(mapIngredientRow)
}

function toIngredientRow(input: IngredientInput) {
  return {
    name_vi: input.nameVi,
    name_en: input.nameEn,
    subtitle_vi: input.subtitleVi,
    subtitle_en: input.subtitleEn,
    unit: input.unit,
    low_stock_threshold: input.threshold,
    icon: input.icon,
  }
}

export async function createIngredient(supabase: SupabaseClient, input: IngredientInput): Promise<Ingredient> {
  const { data, error } = await supabase
    .from("ingredients")
    .insert(toIngredientRow(input))
    .select(INGREDIENT_SELECT)
    .single()
  if (error) throw error
  return mapIngredientRow(data as IngredientRow)
}

export async function updateIngredient(
  supabase: SupabaseClient,
  id: string,
  input: IngredientInput
): Promise<Ingredient> {
  const { data, error } = await supabase
    .from("ingredients")
    .update(toIngredientRow(input))
    .eq("id", id)
    .select(INGREDIENT_SELECT)
    .single()
  if (error) throw error
  return mapIngredientRow(data as IngredientRow)
}

export async function adjustStock(
  supabase: SupabaseClient,
  id: string,
  change: number,
  reason: InventoryLogReason
): Promise<Ingredient> {
  const { data, error } = await supabase.rpc("adjust_ingredient_stock", {
    p_ingredient_id: id,
    p_change: change,
    p_reason: reason,
  })
  if (error) throw error
  return mapIngredientRow(data as IngredientRow)
}

type InventoryLogRow = {
  id: string
  ingredient_id: string
  change_quantity: number
  reason: InventoryLogReason
  created_at: string
}

export function mapInventoryLogRow(
  row: InventoryLogRow,
  ingredientNameVi: string,
  ingredientNameEn: string
): InventoryLog {
  return {
    id: row.id,
    ingredientId: row.ingredient_id,
    ingredientNameVi,
    ingredientNameEn,
    change: row.change_quantity,
    reason: row.reason,
    timestamp: new Date(row.created_at).getTime(),
  }
}

type InventoryLogJoinRow = InventoryLogRow & {
  ingredients: { name_vi: string; name_en: string } | null
}

export async function getInventoryLogs(supabase: SupabaseClient): Promise<InventoryLog[]> {
  const { data, error } = await supabase
    .from("inventory_logs")
    .select("id, ingredient_id, change_quantity, reason, created_at, ingredients ( name_vi, name_en )")
    .order("created_at", { ascending: false })
    .limit(200)
  if (error) throw error
  return ((data ?? []) as unknown as InventoryLogJoinRow[]).map((row) =>
    mapInventoryLogRow(row, row.ingredients?.name_vi ?? "", row.ingredients?.name_en ?? "")
  )
}

type RecipeRow = { ingredient_id: string; quantity_used: number }

export async function getMenuItemIngredients(supabase: SupabaseClient, menuItemId: string): Promise<RecipeEntry[]> {
  const { data, error } = await supabase
    .from("menu_item_ingredients")
    .select("ingredient_id, quantity_used")
    .eq("menu_item_id", menuItemId)
  if (error) throw error
  return ((data ?? []) as RecipeRow[]).map((row) => ({ ingredientId: row.ingredient_id, quantityUsed: row.quantity_used }))
}

export async function setMenuItemIngredients(
  supabase: SupabaseClient,
  menuItemId: string,
  entries: RecipeEntry[]
): Promise<void> {
  const { error: deleteError } = await supabase.from("menu_item_ingredients").delete().eq("menu_item_id", menuItemId)
  if (deleteError) throw deleteError
  if (entries.length === 0) return
  const { error: insertError } = await supabase
    .from("menu_item_ingredients")
    .insert(entries.map((e) => ({ menu_item_id: menuItemId, ingredient_id: e.ingredientId, quantity_used: e.quantityUsed })))
  if (insertError) throw insertError
}

export async function getModifierIngredients(supabase: SupabaseClient, modifierId: string): Promise<RecipeEntry[]> {
  const { data, error } = await supabase
    .from("modifier_ingredients")
    .select("ingredient_id, quantity_used")
    .eq("modifier_id", modifierId)
  if (error) throw error
  return ((data ?? []) as RecipeRow[]).map((row) => ({ ingredientId: row.ingredient_id, quantityUsed: row.quantity_used }))
}

export async function setModifierIngredients(
  supabase: SupabaseClient,
  modifierId: string,
  entries: RecipeEntry[]
): Promise<void> {
  const { error: deleteError } = await supabase.from("modifier_ingredients").delete().eq("modifier_id", modifierId)
  if (deleteError) throw deleteError
  if (entries.length === 0) return
  const { error: insertError } = await supabase
    .from("modifier_ingredients")
    .insert(entries.map((e) => ({ modifier_id: modifierId, ingredient_id: e.ingredientId, quantity_used: e.quantityUsed })))
  if (insertError) throw insertError
}
