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
  customerName: string
}

type RedemptionLookupRow = {
  id: string
  reward_name_vi: string
  reward_name_en: string
  points_spent: number
  redeemed_at: string
  fulfilled_at: string | null
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
    customerName: row.customer_name,
  }))
}

export async function fulfillRedemption(supabase: SupabaseClient, redemptionId: string): Promise<number> {
  const { data, error } = await supabase.rpc("fulfill_redemption", { p_redemption_id: redemptionId })
  if (error) throw error
  return new Date(data as string).getTime()
}
