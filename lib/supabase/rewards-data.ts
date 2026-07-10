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
