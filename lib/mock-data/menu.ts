/**
 * Placeholder menu data for building/testing the frontend before the
 * Supabase `menu_items`/`categories`/`menu_item_sizes`/`modifier_groups`
 * tables exist (see docs/superpowers/plans/2026-07-04-coffee-shop-scaffold.md).
 *
 * NOTE: the planned DB schema (design spec Section 2) stores a single
 * `name`/`description` per menu item, not separate VI/EN columns. This mock
 * data uses `nameVi`/`nameEn` for convenience during frontend-only work —
 * when the real schema is built, decide whether menu content itself needs
 * translation columns or whether it's entered once (e.g. Vietnamese only,
 * since staff/admin manage it) and only the app chrome stays bilingual.
 */

export type MenuIcon = "coffee" | "cup-soda" | "cookie" | "milk"

export type MenuItemSize = {
  id: string
  label: string
  priceDelta: number
}

export type MenuModifierOption = {
  id: string
  labelVi: string
  labelEn: string
  priceDelta: number
}

export type MenuModifierGroup = {
  id: string
  labelVi: string
  labelEn: string
  required: boolean
  options: MenuModifierOption[]
}

export type MenuItem = {
  id: string
  categoryId: string
  nameVi: string
  nameEn: string
  descriptionVi: string
  descriptionEn: string
  basePrice: number
  icon: MenuIcon
  isAvailable: boolean
  isPopular?: boolean
  sizes?: MenuItemSize[]
  modifierGroups?: MenuModifierGroup[]
  /** Real image (e.g. an admin's uploaded file, as an object URL) — falls back to the icon placeholder when unset. */
  imageUrl?: string
  /** Mock rating summary, 1-5 — no reviews table yet, see lib/mock-data/reviews.ts. */
  rating?: number
  reviewCount?: number
}

export type MenuCategory = {
  id: string
  labelVi: string
  labelEn: string
}

export const menuCategories: MenuCategory[] = [
  { id: "coffee", labelVi: "Cà Phê", labelEn: "Coffee" },
  { id: "tea", labelVi: "Trà", labelEn: "Tea" },
  { id: "pastries", labelVi: "Bánh Ngọt", labelEn: "Pastries" },
  { id: "blended", labelVi: "Đá Xay", labelEn: "Blended" },
]

const milkModifierGroup: MenuModifierGroup = {
  id: "milk",
  labelVi: "Lựa Chọn Sữa",
  labelEn: "Milk Options",
  required: true,
  options: [
    { id: "condensed", labelVi: "Sữa Đặc", labelEn: "Condensed Milk", priceDelta: 0 },
    { id: "fresh", labelVi: "Sữa Tươi", labelEn: "Fresh Milk", priceDelta: 5000 },
  ],
}

const sizeOptions: MenuItemSize[] = [
  { id: "s", label: "S", priceDelta: -5000 },
  { id: "m", label: "M", priceDelta: 0 },
  { id: "l", label: "L", priceDelta: 8000 },
]

export const menuItems: MenuItem[] = [
  {
    id: "phin-sua-da",
    categoryId: "coffee",
    nameVi: "Phin Sữa Đá",
    nameEn: "Iced Milk Coffee",
    descriptionVi: "Cà phê phin truyền thống hòa quyện cùng sữa đặc béo ngậy.",
    descriptionEn: "Authentic drip coffee with condensed milk.",
    basePrice: 29000,
    icon: "coffee",
    isAvailable: true,
    isPopular: true,
    sizes: sizeOptions,
    modifierGroups: [milkModifierGroup],
    rating: 4.6,
    reviewCount: 128,
  },
  {
    id: "ca-phe-den",
    categoryId: "coffee",
    nameVi: "Cà Phê Đen",
    nameEn: "Black Coffee",
    descriptionVi: "Đậm đà hương vị truyền thống.",
    descriptionEn: "Strong and bold traditional taste.",
    basePrice: 25000,
    icon: "coffee",
    isAvailable: true,
    sizes: sizeOptions,
    rating: 4.3,
    reviewCount: 64,
  },
  {
    id: "ca-phe-trung",
    categoryId: "coffee",
    nameVi: "Cà Phê Trứng",
    nameEn: "Egg Coffee",
    descriptionVi: "Hương vị Hà Nội nồng nàn.",
    descriptionEn: "Signature Hanoi creamy egg foam.",
    basePrice: 45000,
    icon: "coffee",
    isAvailable: true,
    rating: 4.8,
    reviewCount: 96,
  },
  {
    id: "bac-xiu",
    categoryId: "coffee",
    nameVi: "Bạc Xỉu",
    nameEn: "White Coffee",
    descriptionVi: "Nhiều sữa ít cà phê.",
    descriptionEn: "Milk-forward coffee delight.",
    basePrice: 32000,
    icon: "milk",
    isAvailable: false,
    sizes: sizeOptions,
    rating: 4.4,
    reviewCount: 41,
  },
  {
    id: "tra-sen-vang",
    categoryId: "tea",
    nameVi: "Trà Sen Vàng",
    nameEn: "Golden Lotus Tea",
    descriptionVi: "Thanh mát hương sen tự nhiên.",
    descriptionEn: "Refreshing natural lotus fragrance.",
    basePrice: 39000,
    icon: "cup-soda",
    isAvailable: true,
    sizes: sizeOptions,
    rating: 4.5,
    reviewCount: 57,
  },
  {
    id: "tra-vai",
    categoryId: "tea",
    nameVi: "Trà Vải",
    nameEn: "Lychee Tea",
    descriptionVi: "Vị ngọt trái cây tươi mát.",
    descriptionEn: "Sweet, refreshing fruit flavor.",
    basePrice: 35000,
    icon: "cup-soda",
    isAvailable: true,
    rating: 4.2,
    reviewCount: 33,
  },
  {
    id: "banh-mi-que",
    categoryId: "pastries",
    nameVi: "Bánh Mì Que",
    nameEn: "Crispy Breadsticks",
    descriptionVi: "Giòn rụm, dùng kèm pate.",
    descriptionEn: "Crispy breadsticks served with pate.",
    basePrice: 19000,
    icon: "cookie",
    isAvailable: true,
    rating: 4.1,
    reviewCount: 22,
  },
  {
    id: "banh-croissant",
    categoryId: "pastries",
    nameVi: "Bánh Croissant Bơ",
    nameEn: "Butter Croissant",
    descriptionVi: "Lớp vỏ giòn tan, thơm bơ.",
    descriptionEn: "Flaky, buttery layers.",
    basePrice: 28000,
    icon: "cookie",
    isAvailable: true,
    rating: 4.7,
    reviewCount: 74,
  },
  {
    id: "ca-phe-da-xay",
    categoryId: "blended",
    nameVi: "Cà Phê Đá Xay",
    nameEn: "Coffee Frappe",
    descriptionVi: "Mát lạnh, sánh mịn.",
    descriptionEn: "Cold, smooth, and creamy.",
    basePrice: 42000,
    icon: "cup-soda",
    isAvailable: true,
    sizes: sizeOptions,
    rating: 4.5,
    reviewCount: 48,
  },
]
