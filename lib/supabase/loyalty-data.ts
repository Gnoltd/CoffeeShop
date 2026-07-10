import type { SupabaseClient } from "@supabase/supabase-js"

export type LoyaltyTransactionType = "earn" | "redeem" | "adjust"

export type LoyaltyTransaction = {
  id: string
  type: LoyaltyTransactionType
  createdAt: number
  orderId: string | null
  pointsChange: number
}

export async function getLoyaltyBalance(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("profiles")
    .select("loyalty_points_balance")
    .eq("id", userId)
    .single()
  if (error) throw error
  return data.loyalty_points_balance as number
}

type LoyaltyTransactionRow = {
  id: string
  type: LoyaltyTransactionType
  created_at: string
  order_id: string | null
  points_change: number
}

export type LoyaltyTierProgress = {
  lifetimePoints: number
  currentTierNameVi: string
  currentTierNameEn: string
  nextTierNameVi: string | null
  nextTierNameEn: string | null
  pointsToNext: number | null
  progressPercent: number
}

export async function getLoyaltyTierProgress(supabase: SupabaseClient): Promise<LoyaltyTierProgress> {
  const { data, error } = await supabase.rpc("get_my_loyalty_tier_progress").single()
  if (error) throw error
  const row = data as {
    lifetime_points: number
    current_tier_name_vi: string
    current_tier_name_en: string
    next_tier_name_vi: string | null
    next_tier_name_en: string | null
    points_to_next: number | null
    progress_percent: number
  }
  return {
    lifetimePoints: row.lifetime_points,
    currentTierNameVi: row.current_tier_name_vi,
    currentTierNameEn: row.current_tier_name_en,
    nextTierNameVi: row.next_tier_name_vi,
    nextTierNameEn: row.next_tier_name_en,
    pointsToNext: row.points_to_next,
    progressPercent: row.progress_percent,
  }
}

export async function getLoyaltyTransactions(supabase: SupabaseClient): Promise<LoyaltyTransaction[]> {
  const { data, error } = await supabase
    .from("loyalty_transactions")
    .select("id, type, created_at, order_id, points_change")
    .order("created_at", { ascending: false })
    .limit(20)
  if (error) throw error
  return ((data ?? []) as LoyaltyTransactionRow[]).map((row) => ({
    id: row.id,
    type: row.type,
    createdAt: new Date(row.created_at).getTime(),
    orderId: row.order_id,
    pointsChange: row.points_change,
  }))
}
