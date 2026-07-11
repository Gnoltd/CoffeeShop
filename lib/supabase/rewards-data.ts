import type { SupabaseClient } from "@supabase/supabase-js"

export type Reward = {
  id: string
  nameVi: string
  nameEn: string
  descriptionVi: string
  descriptionEn: string
  pointsCost: number
}

type RewardRow = {
  id: string
  name_vi: string
  name_en: string
  description_vi: string
  description_en: string
  points_cost: number
}

export async function getRewardsCatalog(supabase: SupabaseClient): Promise<Reward[]> {
  const { data, error } = await supabase
    .from("rewards")
    .select("id, name_vi, name_en, description_vi, description_en, points_cost")
    .eq("active", true)
    .order("sort_order", { ascending: true })
  if (error) throw error
  return ((data ?? []) as RewardRow[]).map((row) => ({
    id: row.id,
    nameVi: row.name_vi,
    nameEn: row.name_en,
    descriptionVi: row.description_vi,
    descriptionEn: row.description_en,
    pointsCost: row.points_cost,
  }))
}

export async function redeemReward(supabase: SupabaseClient, rewardId: string): Promise<string> {
  const { data, error } = await supabase.rpc("redeem_reward", { p_reward_id: rewardId })
  if (error) throw error
  return data as string
}

export type RedemptionLookup = {
  id: string
  rewardNameVi: string
  rewardNameEn: string
  pointsSpent: number
  redeemedAt: number
  fulfilledAt: number | null
  appliedOrderId: string | null
  customerName: string
}

type RedemptionLookupRow = {
  id: string
  reward_name_vi: string
  reward_name_en: string
  points_spent: number
  redeemed_at: string
  fulfilled_at: string | null
  applied_order_id: string | null
  customer_name: string
}

export async function findRedemptionByCode(supabase: SupabaseClient, code: string): Promise<RedemptionLookup[]> {
  const { data, error } = await supabase.rpc("find_redemption_by_code", { p_code: code })
  if (error) throw error
  return ((data ?? []) as RedemptionLookupRow[]).map((row) => ({
    id: row.id,
    rewardNameVi: row.reward_name_vi,
    rewardNameEn: row.reward_name_en,
    pointsSpent: row.points_spent,
    redeemedAt: new Date(row.redeemed_at).getTime(),
    fulfilledAt: row.fulfilled_at ? new Date(row.fulfilled_at).getTime() : null,
    appliedOrderId: row.applied_order_id,
    customerName: row.customer_name,
  }))
}

export async function fulfillRedemption(supabase: SupabaseClient, redemptionId: string): Promise<number> {
  const { data, error } = await supabase.rpc("fulfill_redemption", { p_redemption_id: redemptionId })
  if (error) throw error
  return new Date(data as string).getTime()
}

export type MyRedemption = {
  id: string
  rewardNameVi: string
  rewardNameEn: string
  pointsSpent: number
  discountValueVnd: number
  redeemedAt: number
  appliedOrderId: string | null
  fulfilledAt: number | null
  expiresAt: number
  isUsed: boolean
  isExpired: boolean
}

type MyRedemptionRow = {
  id: string
  reward_name_vi: string
  reward_name_en: string
  points_spent: number
  discount_value_vnd: number
  redeemed_at: string
  applied_order_id: string | null
  fulfilled_at: string | null
  expires_at: string
  is_used: boolean
  is_expired: boolean
}

export async function getMyRedemptions(supabase: SupabaseClient): Promise<MyRedemption[]> {
  const { data, error } = await supabase.rpc("get_my_redemptions")
  if (error) throw error
  return ((data ?? []) as MyRedemptionRow[]).map((row) => ({
    id: row.id,
    rewardNameVi: row.reward_name_vi,
    rewardNameEn: row.reward_name_en,
    pointsSpent: row.points_spent,
    discountValueVnd: row.discount_value_vnd,
    redeemedAt: new Date(row.redeemed_at).getTime(),
    appliedOrderId: row.applied_order_id,
    fulfilledAt: row.fulfilled_at ? new Date(row.fulfilled_at).getTime() : null,
    expiresAt: new Date(row.expires_at).getTime(),
    isUsed: row.is_used,
    isExpired: row.is_expired,
  }))
}
