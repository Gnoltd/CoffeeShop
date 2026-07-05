/**
 * Placeholder reviews for the Product Detail page — no `reviews` table
 * yet. MOCK_RATING/MOCK_REVIEW_COUNT and this shared review list are both
 * reused identically across every product, not per-item content.
 */

/**
 * Rating summary shown on every product — genuinely mock, not per-item.
 * There's no reviews table to aggregate a real average/count from; this
 * matches MOCK_REVIEWS below (one shared set of reviews reused across
 * every product) rather than inventing per-item precision that isn't real.
 */
export const MOCK_RATING = 4.5
export const MOCK_REVIEW_COUNT = 75

export type Review = {
  id: string
  reviewerName: string
  rating: number
  commentVi: string
  commentEn: string
  daysAgo: number
}

export const MOCK_REVIEWS: Review[] = [
  {
    id: "r1",
    reviewerName: "Minh Anh",
    rating: 5,
    commentVi: "Cà phê rất ngon, đậm đà đúng vị. Sẽ quay lại!",
    commentEn: "Really delicious coffee, rich and authentic. Will come back!",
    daysAgo: 2,
  },
  {
    id: "r2",
    reviewerName: "Thảo Nguyên",
    rating: 4,
    commentVi: "Vị ổn, giao đúng giờ, đóng gói cẩn thận.",
    commentEn: "Good taste, delivered on time, well packaged.",
    daysAgo: 5,
  },
  {
    id: "r3",
    reviewerName: "David T.",
    rating: 5,
    commentVi: "Ngon nhất trong số cà phê Việt Nam tôi từng uống ở nước ngoài!",
    commentEn: "Best Vietnamese coffee I've had outside of Vietnam!",
    daysAgo: 9,
  },
]
