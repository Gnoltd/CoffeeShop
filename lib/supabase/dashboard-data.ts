import type { SupabaseClient } from "@supabase/supabase-js"

export type DashboardDayRevenue = { date: string; revenue: number }
export type DashboardBestSeller = { nameVi: string; nameEn: string; quantitySold: number }

export type DashboardStats = {
  todayRevenue: number
  ordersToday: number
  loyaltyIssuedToday: number
  sevenDayRevenue: DashboardDayRevenue[]
  bestSellers: DashboardBestSeller[]
}

export async function getDashboardStats(supabase: SupabaseClient): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc("get_dashboard_stats")
  if (error) throw error
  return data as DashboardStats
}
