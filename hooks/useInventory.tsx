"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

export type IngredientIcon = "coffee" | "droplet" | "wheat" | "candy"

export type Ingredient = {
  id: string
  nameVi: string
  nameEn: string
  subtitleVi: string
  subtitleEn: string
  unit: string
  stock: number
  threshold: number
  icon: IngredientIcon
}

export type InventoryLog = {
  id: string
  ingredientId: string
  ingredientNameVi: string
  ingredientNameEn: string
  change: number
  timestamp: number
}

/** No `ingredients`/`inventory_logs` tables yet — fixed mock data matching the Stitch mockup's example values. */
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
    icon: "coffee",
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
    icon: "droplet",
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
    icon: "wheat",
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
    icon: "candy",
  },
]

type InventoryContextValue = {
  ingredients: Ingredient[]
  logs: InventoryLog[]
  restock: (id: string) => void
}

const InventoryContext = createContext<InventoryContextValue | null>(null)

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [ingredients, setIngredients] = useState<Ingredient[]>(INITIAL_INGREDIENTS)
  const [logs, setLogs] = useState<InventoryLog[]>([])

  function restock(id: string) {
    const ingredient = ingredients.find((i) => i.id === id)
    if (!ingredient) return
    const change = ingredient.threshold

    setIngredients((prev) =>
      prev.map((i) => (i.id === id ? { ...i, stock: i.stock + change } : i))
    )
    setLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        ingredientId: id,
        ingredientNameVi: ingredient.nameVi,
        ingredientNameEn: ingredient.nameEn,
        change,
        timestamp: Date.now(),
      },
      ...prev,
    ])
  }

  return (
    <InventoryContext.Provider value={{ ingredients, logs, restock }}>
      {children}
    </InventoryContext.Provider>
  )
}

export function useInventory(): InventoryContextValue {
  const ctx = useContext(InventoryContext)
  if (!ctx) throw new Error("useInventory must be used within an InventoryProvider")
  return ctx
}
