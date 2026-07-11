import { describe, it, expect, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getRewardsCatalog, redeemReward, findRedemptionByCode, fulfillRedemption, getMyRedemptions } from "./rewards-data"

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

describe("findRedemptionByCode", () => {
  it("passes the code to the RPC and maps rows to camelCase", async () => {
    const row = {
      id: "redemption-1",
      reward_name_vi: "Cà Phê Đen Miễn Phí",
      reward_name_en: "Free Black Coffee",
      points_spent: 50,
      redeemed_at: "2026-07-11T05:00:00.000Z",
      fulfilled_at: null,
      applied_order_id: null,
      customer_name: "Nguyễn Văn An",
    }
    const rpcSpy = vi.fn(() => Promise.resolve({ data: [row], error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    const result = await findRedemptionByCode(supabase, "REDEMPT")

    expect(rpcSpy).toHaveBeenCalledWith("find_redemption_by_code", { p_code: "REDEMPT" })
    expect(result).toEqual([
      {
        id: "redemption-1",
        rewardNameVi: "Cà Phê Đen Miễn Phí",
        rewardNameEn: "Free Black Coffee",
        pointsSpent: 50,
        redeemedAt: new Date("2026-07-11T05:00:00.000Z").getTime(),
        fulfilledAt: null,
        appliedOrderId: null,
        customerName: "Nguyễn Văn An",
      },
    ])
  })

  it("returns an empty array when no redemption matches the code", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ data: null, error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    expect(await findRedemptionByCode(supabase, "NOMATCH")).toEqual([])
  })
})

describe("fulfillRedemption", () => {
  it("passes the redemption id to the RPC and returns the fulfilled timestamp", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ data: "2026-07-11T05:10:00.000Z", error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    const fulfilledAt = await fulfillRedemption(supabase, "redemption-1")

    expect(rpcSpy).toHaveBeenCalledWith("fulfill_redemption", { p_redemption_id: "redemption-1" })
    expect(fulfilledAt).toBe(new Date("2026-07-11T05:10:00.000Z").getTime())
  })

  it("throws when the RPC errors (e.g. already_fulfilled)", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ data: null, error: new Error("already_fulfilled") }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    await expect(fulfillRedemption(supabase, "redemption-1")).rejects.toThrow("already_fulfilled")
  })
})

describe("getMyRedemptions", () => {
  it("calls the RPC and maps rows to camelCase, including used/expired flags", async () => {
    const row = {
      id: "redemption-1",
      reward_name_vi: "Cà Phê Đen Miễn Phí",
      reward_name_en: "Free Black Coffee",
      points_spent: 50,
      discount_value_vnd: 25000,
      redeemed_at: "2026-07-11T05:00:00.000Z",
      applied_order_id: null,
      fulfilled_at: null,
      expires_at: "2027-07-11T05:00:00.000Z",
      is_used: false,
      is_expired: false,
    }
    const rpcSpy = vi.fn(() => Promise.resolve({ data: [row], error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    const result = await getMyRedemptions(supabase)

    expect(rpcSpy).toHaveBeenCalledWith("get_my_redemptions")
    expect(result).toEqual([
      {
        id: "redemption-1",
        rewardNameVi: "Cà Phê Đen Miễn Phí",
        rewardNameEn: "Free Black Coffee",
        pointsSpent: 50,
        discountValueVnd: 25000,
        redeemedAt: new Date("2026-07-11T05:00:00.000Z").getTime(),
        appliedOrderId: null,
        fulfilledAt: null,
        expiresAt: new Date("2027-07-11T05:00:00.000Z").getTime(),
        isUsed: false,
        isExpired: false,
      },
    ])
  })

  it("returns an empty array when the customer has no redemptions", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ data: null, error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    expect(await getMyRedemptions(supabase)).toEqual([])
  })

  it("throws when the RPC errors", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ data: null, error: new Error("not_authenticated") }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    await expect(getMyRedemptions(supabase)).rejects.toThrow("not_authenticated")
  })
})
