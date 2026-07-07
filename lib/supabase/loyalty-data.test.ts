import { describe, it, expect, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getLoyaltyBalance, getLoyaltyTransactions } from "./loyalty-data"

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
