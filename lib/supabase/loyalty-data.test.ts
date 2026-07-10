import { describe, it, expect, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getLoyaltyBalance, getLoyaltyTransactions, getLoyaltyTierProgress } from "./loyalty-data"

describe("getLoyaltyBalance", () => {
  it("selects loyalty_points_balance for the given user id", async () => {
    const singleSpy = vi.fn(() => Promise.resolve({ data: { loyalty_points_balance: 340 }, error: null }))
    const eqSpy = vi.fn(() => ({ single: singleSpy }))
    const selectSpy = vi.fn(() => ({ eq: eqSpy }))
    const supabase = { from: () => ({ select: selectSpy }) } as unknown as SupabaseClient

    const balance = await getLoyaltyBalance(supabase, "user-1")

    expect(selectSpy).toHaveBeenCalledWith("loyalty_points_balance")
    expect(eqSpy).toHaveBeenCalledWith("id", "user-1")
    expect(balance).toBe(340)
  })
})

describe("getLoyaltyTransactions", () => {
  it("maps rows, translating created_at to a timestamp", async () => {
    const row = {
      id: "txn-1",
      type: "earn",
      created_at: "2026-07-06T10:00:00.000Z",
      order_id: "ord-1",
      points_change: 6,
    }
    const limitSpy = vi.fn(() => Promise.resolve({ data: [row], error: null }))
    const orderSpy = vi.fn(() => ({ limit: limitSpy }))
    const supabase = {
      from: () => ({ select: () => ({ order: orderSpy }) }),
    } as unknown as SupabaseClient

    const result = await getLoyaltyTransactions(supabase)

    expect(orderSpy).toHaveBeenCalledWith("created_at", { ascending: false })
    expect(limitSpy).toHaveBeenCalledWith(20)
    expect(result).toEqual([
      { id: "txn-1", type: "earn", createdAt: new Date(row.created_at).getTime(), orderId: "ord-1", pointsChange: 6 },
    ])
  })
})

describe("getLoyaltyTierProgress", () => {
  it("maps the snake_case RPC row to a camelCase progress object", async () => {
    const singleSpy = vi.fn(() =>
      Promise.resolve({
        data: {
          lifetime_points: 450,
          current_tier_name_vi: "Bạc",
          current_tier_name_en: "Silver",
          next_tier_name_vi: "Vàng",
          next_tier_name_en: "Gold",
          points_to_next: 550,
          progress_percent: 21,
        },
        error: null,
      }),
    )
    const rpcSpy = vi.fn(() => ({ single: singleSpy }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    const progress = await getLoyaltyTierProgress(supabase)

    expect(rpcSpy).toHaveBeenCalledWith("get_my_loyalty_tier_progress")
    expect(progress).toEqual({
      lifetimePoints: 450,
      currentTierNameVi: "Bạc",
      currentTierNameEn: "Silver",
      nextTierNameVi: "Vàng",
      nextTierNameEn: "Gold",
      pointsToNext: 550,
      progressPercent: 21,
    })
  })

  it("handles the max-tier case where next-tier fields are null", async () => {
    const singleSpy = vi.fn(() =>
      Promise.resolve({
        data: {
          lifetime_points: 3200,
          current_tier_name_vi: "Kim Cương",
          current_tier_name_en: "Diamond",
          next_tier_name_vi: null,
          next_tier_name_en: null,
          points_to_next: null,
          progress_percent: 100,
        },
        error: null,
      }),
    )
    const rpcSpy = vi.fn(() => ({ single: singleSpy }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    const progress = await getLoyaltyTierProgress(supabase)

    expect(progress.nextTierNameVi).toBeNull()
    expect(progress.nextTierNameEn).toBeNull()
    expect(progress.pointsToNext).toBeNull()
    expect(progress.progressPercent).toBe(100)
    expect(progress.currentTierNameEn).toBe("Diamond")
  })

  it("throws when the RPC returns an error", async () => {
    const singleSpy = vi.fn(() => Promise.resolve({ data: null, error: new Error("not_authenticated") }))
    const rpcSpy = vi.fn(() => ({ single: singleSpy }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    await expect(getLoyaltyTierProgress(supabase)).rejects.toThrow("not_authenticated")
  })
})
