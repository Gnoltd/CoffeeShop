import { describe, it, expect, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getRewardsCatalog, redeemReward } from "./rewards-data"

describe("getRewardsCatalog", () => {
  it("selects active rewards ordered by sort_order and maps to camelCase", async () => {
    const row = {
      id: "rw-1",
      name_vi: "Cà Phê Đen Miễn Phí",
      name_en: "Free Black Coffee",
      description_vi: "Đổi điểm lấy một ly cà phê đen miễn phí.",
      description_en: "Redeem for one free black coffee.",
      points_cost: 50,
    }
    const orderSpy = vi.fn(() => Promise.resolve({ data: [row], error: null }))
    const eqSpy = vi.fn(() => ({ order: orderSpy }))
    const selectSpy = vi.fn(() => ({ eq: eqSpy }))
    const supabase = { from: () => ({ select: selectSpy }) } as unknown as SupabaseClient

    const result = await getRewardsCatalog(supabase)

    expect(selectSpy).toHaveBeenCalledWith("id, name_vi, name_en, description_vi, description_en, points_cost")
    expect(eqSpy).toHaveBeenCalledWith("active", true)
    expect(orderSpy).toHaveBeenCalledWith("sort_order", { ascending: true })
    expect(result).toEqual([
      {
        id: "rw-1",
        nameVi: "Cà Phê Đen Miễn Phí",
        nameEn: "Free Black Coffee",
        descriptionVi: "Đổi điểm lấy một ly cà phê đen miễn phí.",
        descriptionEn: "Redeem for one free black coffee.",
        pointsCost: 50,
      },
    ])
  })

  it("returns an empty array when there are no rewards", async () => {
    const orderSpy = vi.fn(() => Promise.resolve({ data: null, error: null }))
    const supabase = {
      from: () => ({ select: () => ({ eq: () => ({ order: orderSpy }) }) }),
    } as unknown as SupabaseClient

    expect(await getRewardsCatalog(supabase)).toEqual([])
  })

  it("throws when the query errors", async () => {
    const orderSpy = vi.fn(() => Promise.resolve({ data: null, error: new Error("boom") }))
    const supabase = {
      from: () => ({ select: () => ({ eq: () => ({ order: orderSpy }) }) }),
    } as unknown as SupabaseClient

    await expect(getRewardsCatalog(supabase)).rejects.toThrow("boom")
  })
})

describe("redeemReward", () => {
  it("passes the reward id to the RPC and returns the new redemption id", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ data: "redemption-1", error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    const id = await redeemReward(supabase, "rw-1")

    expect(rpcSpy).toHaveBeenCalledWith("redeem_reward", { p_reward_id: "rw-1" })
    expect(id).toBe("redemption-1")
  })

  it("throws when the RPC errors (e.g. insufficient_points)", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ data: null, error: new Error("insufficient_points") }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    await expect(redeemReward(supabase, "rw-1")).rejects.toThrow("insufficient_points")
  })
})
