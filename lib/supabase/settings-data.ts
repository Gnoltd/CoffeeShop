import type { SupabaseClient } from "@supabase/supabase-js"

export type ShopSettings = {
  shopName: string
  address: string
  phone: string
  openingHours: string
  taxRatePercent: number
}

export type ShopSettingsInput = {
  shopName: string
  address: string
  phone: string
  openingHours: string
  taxRatePercent: number
}

type ShopSettingsRow = {
  shop_name: string
  address: string | null
  phone: string | null
  opening_hours: string | null
  tax_rate: number | string
}

export async function getShopSettings(supabase: SupabaseClient): Promise<ShopSettings> {
  const { data, error } = await supabase
    .from("shop_settings")
    .select("shop_name, address, phone, opening_hours, tax_rate")
    .eq("id", 1)
    .single()
  if (error) throw error
  const row = data as ShopSettingsRow
  return {
    shopName: row.shop_name,
    address: row.address ?? "",
    phone: row.phone ?? "",
    openingHours: row.opening_hours ?? "",
    taxRatePercent: Number(row.tax_rate) * 100,
  }
}

export async function updateShopSettings(supabase: SupabaseClient, input: ShopSettingsInput): Promise<void> {
  const { error } = await supabase
    .from("shop_settings")
    .update({
      shop_name: input.shopName,
      address: input.address,
      phone: input.phone,
      opening_hours: input.openingHours,
      tax_rate: input.taxRatePercent / 100,
    })
    .eq("id", 1)
  if (error) throw error
}

export type LoyaltySettings = {
  enabled: boolean
  earnRateVndPerPoint: number
  redeemValueVndPerPoint: number
}

export type LoyaltySettingsInput = {
  enabled: boolean
  earnRateVndPerPoint: number
  redeemValueVndPerPoint: number
}

type LoyaltySettingsRow = {
  enabled: boolean
  earn_rate_vnd_per_point: number
  redeem_value_vnd_per_point: number
}

export async function getLoyaltySettings(supabase: SupabaseClient): Promise<LoyaltySettings> {
  const { data, error } = await supabase
    .from("loyalty_settings")
    .select("enabled, earn_rate_vnd_per_point, redeem_value_vnd_per_point")
    .eq("id", 1)
    .single()
  if (error) throw error
  const row = data as LoyaltySettingsRow
  return {
    enabled: row.enabled,
    earnRateVndPerPoint: row.earn_rate_vnd_per_point,
    redeemValueVndPerPoint: row.redeem_value_vnd_per_point,
  }
}

export async function updateLoyaltySettings(supabase: SupabaseClient, input: LoyaltySettingsInput): Promise<void> {
  const { error } = await supabase
    .from("loyalty_settings")
    .update({
      enabled: input.enabled,
      earn_rate_vnd_per_point: input.earnRateVndPerPoint,
      redeem_value_vnd_per_point: input.redeemValueVndPerPoint,
    })
    .eq("id", 1)
  if (error) throw error
}
