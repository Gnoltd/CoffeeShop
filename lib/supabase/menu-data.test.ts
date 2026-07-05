import { describe, it, expect, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getCategories } from "./menu-data"
import { getMenuItems } from "./menu-data"
import { createMenuItem } from "./menu-data"

function fakeSupabase(rows: unknown[]) {
  return {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: rows, error: null }),
      }),
    }),
  } as unknown as SupabaseClient
}

describe("getCategories", () => {
  it("maps snake_case DB rows to camelCase MenuCategory", async () => {
    const supabase = fakeSupabase([
      { id: "cat-1", name_vi: "Cà Phê", name_en: "Coffee", sort_order: 0 },
    ])
    const result = await getCategories(supabase)
    expect(result).toEqual([
      { id: "cat-1", nameVi: "Cà Phê", nameEn: "Coffee", sortOrder: 0 },
    ])
  })
})

describe("getMenuItems", () => {
  it("flattens nested sizes and modifier groups into camelCase", async () => {
    const row = {
      id: "item-1",
      category_id: "cat-1",
      name_vi: "Phin Sữa Đá",
      name_en: "Iced Milk Coffee",
      description_vi: "mô tả",
      description_en: "description",
      base_price: 29000,
      icon: "coffee",
      is_available: true,
      is_popular: true,
      image_url: null,
      menu_item_sizes: [{ id: "size-1", name: "M", price_delta: 0 }],
      menu_item_modifier_groups: [
        {
          modifier_groups: {
            id: "grp-1",
            name_vi: "Lựa Chọn Sữa",
            name_en: "Milk Options",
            is_required: true,
            modifiers: [
              { id: "mod-1", name_vi: "Sữa Đặc", name_en: "Condensed Milk", price_delta: 0 },
            ],
          },
        },
      ],
    }
    const supabase = {
      from: () => ({
        select: () => Promise.resolve({ data: [row], error: null }),
      }),
    } as unknown as SupabaseClient

    const result = await getMenuItems(supabase)

    expect(result).toEqual([
      {
        id: "item-1",
        categoryId: "cat-1",
        nameVi: "Phin Sữa Đá",
        nameEn: "Iced Milk Coffee",
        descriptionVi: "mô tả",
        descriptionEn: "description",
        basePrice: 29000,
        icon: "coffee",
        isAvailable: true,
        isPopular: true,
        imageUrl: null,
        sizes: [{ id: "size-1", name: "M", priceDelta: 0 }],
        modifierGroups: [
          {
            id: "grp-1",
            nameVi: "Lựa Chọn Sữa",
            nameEn: "Milk Options",
            required: true,
            options: [{ id: "mod-1", nameVi: "Sữa Đặc", nameEn: "Condensed Milk", priceDelta: 0 }],
          },
        ],
      },
    ])
  })
})

describe("createMenuItem", () => {
  it("inserts snake_case columns and returns the mapped row", async () => {
    const insertedRow = {
      id: "item-new",
      category_id: "cat-1",
      name_vi: "Trà Đào",
      name_en: "Peach Tea",
      description_vi: "mô tả",
      description_en: "description",
      base_price: 35000,
      icon: "cup-soda",
      is_available: true,
      is_popular: false,
      image_url: null,
      menu_item_sizes: [],
      menu_item_modifier_groups: [],
    }
    const insertSpy = vi.fn(() => ({
      select: () => ({
        single: () => Promise.resolve({ data: insertedRow, error: null }),
      }),
    }))
    const supabase = { from: () => ({ insert: insertSpy }) } as unknown as SupabaseClient

    const result = await createMenuItem(supabase, {
      categoryId: "cat-1",
      nameVi: "Trà Đào",
      nameEn: "Peach Tea",
      descriptionVi: "mô tả",
      descriptionEn: "description",
      basePrice: 35000,
      icon: "cup-soda",
      isAvailable: true,
      isPopular: false,
    })

    expect(insertSpy).toHaveBeenCalledWith({
      category_id: "cat-1",
      name_vi: "Trà Đào",
      name_en: "Peach Tea",
      description_vi: "mô tả",
      description_en: "description",
      base_price: 35000,
      icon: "cup-soda",
      is_available: true,
      is_popular: false,
      image_url: null,
    })
    expect(result.id).toBe("item-new")
    expect(result.nameEn).toBe("Peach Tea")
  })
})
