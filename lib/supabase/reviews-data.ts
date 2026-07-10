import type { SupabaseClient } from "@supabase/supabase-js"

export type MenuItemReview = {
  id: string
  reviewerName: string | null
  rating: number
  comment: string
  staffReply: string | null
  staffReplyAt: number | null
  createdAt: number
}

export type MenuItemReviewsResult = {
  reviews: MenuItemReview[]
  avgRating: number
  reviewCount: number
}

type ReviewJsonRow = {
  id: string
  reviewer_name: string | null
  rating: number
  comment: string
  staff_reply: string | null
  staff_reply_at: string | null
  created_at: string
}

type ReviewsRpcResult = {
  reviews: ReviewJsonRow[]
  avgRating: number
  reviewCount: number
}

export async function getMenuItemReviews(supabase: SupabaseClient, itemId: string): Promise<MenuItemReviewsResult> {
  const { data, error } = await supabase.rpc("get_menu_item_reviews", { p_item_id: itemId })
  if (error) throw error
  const result = data as ReviewsRpcResult
  return {
    reviews: result.reviews.map((row) => ({
      id: row.id,
      reviewerName: row.reviewer_name,
      rating: row.rating,
      comment: row.comment,
      staffReply: row.staff_reply,
      staffReplyAt: row.staff_reply_at ? new Date(row.staff_reply_at).getTime() : null,
      createdAt: new Date(row.created_at).getTime(),
    })),
    avgRating: result.avgRating,
    reviewCount: result.reviewCount,
  }
}

export type MyReview = { rating: number; comment: string } | null

export async function getMyReviewForItem(supabase: SupabaseClient, itemId: string): Promise<MyReview> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return null
  const { data, error } = await supabase
    .from("menu_item_reviews")
    .select("rating, comment")
    .eq("menu_item_id", itemId)
    .eq("customer_id", userId)
    .maybeSingle()
  if (error) throw error
  return data ? { rating: data.rating, comment: data.comment } : null
}

export async function submitReview(
  supabase: SupabaseClient,
  itemId: string,
  rating: number,
  comment: string
): Promise<void> {
  const { error } = await supabase.rpc("submit_menu_item_review", {
    p_item_id: itemId,
    p_rating: rating,
    p_comment: comment,
  })
  if (error) throw error
}

export async function replyToReview(supabase: SupabaseClient, reviewId: string, reply: string): Promise<void> {
  const { error } = await supabase.rpc("reply_to_review", { p_review_id: reviewId, p_reply: reply })
  if (error) throw error
}
