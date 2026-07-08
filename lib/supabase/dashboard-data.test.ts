import { describe, it, expect, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getDashboardStats } from "./dashboard-data"

describe("getDashboardStats", () => {
  it("calls the RPC and returns its jsonb result directly", async () => {
    const result = {
      todayRevenue: 500000,
      ordersToday: 12,
      loyaltyIssuedToday: 50,
      sevenDayRevenue: [{ date: "2026-07-08", revenue: 500000 }],
      bestSellers: [{ nameVi: "Phin Sữa Đá", nameEn: "Iced Milk Coffee", quantitySold: 20 }],
    }
    const rpcSpy = vi.fn(() => Promise.resolve({ data: result, error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    const stats = await getDashboardStats(supabase)

    expect(rpcSpy).toHaveBeenCalledWith("get_dashboard_stats")
    expect(stats.todayRevenue).toBe(500000)
    expect(stats.ordersToday).toBe(12)
    expect(stats.sevenDayRevenue).toEqual(result.sevenDayRevenue)
    expect(stats.bestSellers).toEqual(result.bestSellers)
  })

  it("propagates an RPC error instead of swallowing it", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ data: null, error: { message: "permission denied" } }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    await expect(getDashboardStats(supabase)).rejects.toBeTruthy()
  })
})
