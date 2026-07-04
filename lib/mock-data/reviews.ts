/**
 * Placeholder reviews for the Product Detail page — no `reviews` table yet.
 * Shared generic content reused across every product rather than inventing
 * per-item reviews for all nine mock menu items; each MenuItem's own
 * `rating`/`reviewCount` (lib/mock-data/menu.ts) is what actually varies
 * per product.
 */

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
