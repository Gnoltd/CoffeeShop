"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Coffee, Droplet, Wheat, Candy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Ingredient = {
  id: string
  nameVi: string
  nameEn: string
  subtitleVi: string
  subtitleEn: string
  unit: string
  stock: number
  threshold: number
  icon: typeof Coffee
}

/** No `ingredients` table yet — fixed mock data matching the Stitch mockup's example values. */
const INITIAL_INGREDIENTS: Ingredient[] = [
  {
    id: "robusta-beans",
    nameVi: "Hạt Robusta Đặc Sản",
    nameEn: "Coffee Beans (Roasted)",
    subtitleVi: "Nguyên liệu",
    subtitleEn: "Raw material",
    unit: "kg",
    stock: 5.2,
    threshold: 10,
    icon: Coffee,
  },
  {
    id: "condensed-milk",
    nameVi: "Sữa Đặc Ông Thọ",
    nameEn: "Condensed Milk",
    subtitleVi: "Hàng tiêu dùng",
    subtitleEn: "Consumable",
    unit: "lon / cans",
    stock: 24,
    threshold: 12,
    icon: Droplet,
  },
  {
    id: "creamer-powder",
    nameVi: "Bột Kem Béo",
    nameEn: "Creamer Powder",
    subtitleVi: "Nguyên liệu",
    subtitleEn: "Raw material",
    unit: "kg",
    stock: 8.5,
    threshold: 5,
    icon: Wheat,
  },
  {
    id: "white-sugar",
    nameVi: "Đường Cát Trắng",
    nameEn: "White Sugar",
    subtitleVi: "Nguyên liệu",
    subtitleEn: "Raw material",
    unit: "kg",
    stock: 2.1,
    threshold: 15,
    icon: Candy,
  },
]

export function InventoryManagement({ locale }: { locale: string }) {
  const t = useTranslations("AdminInventory")
  const [ingredients, setIngredients] = useState(INITIAL_INGREDIENTS)

  function restock(id: string) {
    setIngredients((prev) =>
      prev.map((ingredient) =>
        ingredient.id === id
          ? { ...ingredient, stock: ingredient.stock + ingredient.threshold }
          : ingredient
      )
    )
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <h2 className="text-2xl font-bold text-card-foreground">{t("title")}</h2>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">{t("ingredient")}</th>
              <th className="px-4 py-3 font-medium">{t("unit")}</th>
              <th className="px-4 py-3 font-medium">{t("currentStock")}</th>
              <th className="px-4 py-3 font-medium">{t("threshold")}</th>
              <th className="px-4 py-3 font-medium">{t("status")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("restock")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {ingredients.map((ingredient) => {
              const Icon = ingredient.icon
              const isLow = ingredient.stock < ingredient.threshold
              return (
                <tr key={ingredient.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-card-foreground">
                          {locale === "vi" ? ingredient.nameVi : ingredient.nameEn}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {locale === "vi" ? ingredient.subtitleVi : ingredient.subtitleEn}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{ingredient.unit}</td>
                  <td className="px-4 py-3 font-bold text-card-foreground">
                    {ingredient.stock} {ingredient.unit}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {ingredient.threshold} {ingredient.unit}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-bold",
                        isLow
                          ? "border-destructive/20 bg-destructive/10 text-destructive"
                          : "border-green-200 bg-green-100 text-green-700"
                      )}
                    >
                      {isLow ? t("lowStock") : t("inStock")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" className="h-8" onClick={() => restock(ingredient.id)}>
                      {t("restock")}
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
