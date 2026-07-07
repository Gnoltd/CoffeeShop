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
