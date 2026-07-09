import { describe, it, expect, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getMenuItemReviews, getMyReviewForItem, submitReview, replyToReview } from "./reviews-data"

describe("getMenuItemReviews", () => {
  it("maps the RPC's snake_case json rows to camelCase, converting timestamps to epoch ms", async () => {
    const rpcResult = {
      reviews: [
        {
          id: "rev-1",
          reviewer_name: "Minh Anh",
          rating: 5,
          comment: "Rất ngon!",
          staff_reply: "Cảm ơn bạn!",
          staff_reply_at: "2026-07-10T12:00:00Z",
          created_at: "2026-07-09T12:00:00Z",
        },
      ],
      avgRating: 5,
      reviewCount: 1,
    }
    const rpcSpy = vi.fn(() => Promise.resolve({ data: rpcResult, error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    const result = await getMenuItemReviews(supabase, "item-1")

    expect(rpcSpy).toHaveBeenCalledWith("get_menu_item_reviews", { p_item_id: "item-1" })
    expect(result.avgRating).toBe(5)
    expect(result.reviewCount).toBe(1)
    expect(result.reviews[0]).toEqual({
      id: "rev-1",
      reviewerName: "Minh Anh",
      rating: 5,
      comment: "Rất ngon!",
      staffReply: "Cảm ơn bạn!",
      staffReplyAt: new Date("2026-07-10T12:00:00Z").getTime(),
      createdAt: new Date("2026-07-09T12:00:00Z").getTime(),
    })
  })
})

describe("getMyReviewForItem", () => {
  it("returns null when there is no logged-in session", async () => {
    const supabase = {
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    } as unknown as SupabaseClient

    expect(await getMyReviewForItem(supabase, "item-1")).toBeNull()
  })

  it("returns the customer's own review when one exists", async () => {
    const maybeSingle = vi.fn(() => Promise.resolve({ data: { rating: 4, comment: "Ổn" }, error: null }))
    const supabase = {
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "cust-1" } } }) },
      from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }) }),
    } as unknown as SupabaseClient

    expect(await getMyReviewForItem(supabase, "item-1")).toEqual({ rating: 4, comment: "Ổn" })
  })
})

describe("submitReview", () => {
  it("calls submit_menu_item_review with snake_case params", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ data: null, error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    await submitReview(supabase, "item-1", 5, "Great!")

    expect(rpcSpy).toHaveBeenCalledWith("submit_menu_item_review", {
      p_item_id: "item-1",
      p_rating: 5,
      p_comment: "Great!",
    })
  })
})

describe("replyToReview", () => {
  it("calls reply_to_review with snake_case params", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ data: null, error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    await replyToReview(supabase, "rev-1", "Thanks!")

    expect(rpcSpy).toHaveBeenCalledWith("reply_to_review", { p_review_id: "rev-1", p_reply: "Thanks!" })
  })
})
