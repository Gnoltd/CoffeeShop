"use client"

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import {
  adjustStock as adjustStockQuery,
  createIngredient,
  getIngredients,
  getInventoryLogs,
  mapIngredientRow,
  mapInventoryLogRow,
  updateIngredient as updateIngredientQuery,
  type Ingredient,
  type IngredientIcon,
  type IngredientInput,
  type IngredientRow,
  type InventoryLog,
  type InventoryLogReason,
} from "@/lib/supabase/inventory-data"

export type { Ingredient, IngredientIcon, IngredientInput, InventoryLog, InventoryLogReason }

type InventoryContextValue = {
  ingredients: Ingredient[]
  logs: InventoryLog[]
  isLoading: boolean
  error: string | null
  restock: (id: string) => Promise<void>
  adjustStock: (id: string, change: number, reason: InventoryLogReason) => Promise<void>
  setOutOfStock: (id: string) => Promise<void>
  addIngredient: (input: IngredientInput) => Promise<void>
  updateIngredientDetails: (id: string, input: IngredientInput) => Promise<void>
}

const InventoryContext = createContext<InventoryContextValue | null>(null)

type InventoryLogRow = {
  id: string
  ingredient_id: string
  change_quantity: number
  reason: InventoryLogReason
  created_at: string
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => createClient())
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [logs, setLogs] = useState<InventoryLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const ingredientsRef = useRef<Ingredient[]>([])

  useEffect(() => {
    ingredientsRef.current = ingredients
  }, [ingredients])

  useEffect(() => {
    let cancelled = false

    Promise.all([getIngredients(supabase), getInventoryLogs(supabase)])
      .then(([ingredientRows, logRows]) => {
        if (cancelled) return
        setIngredients(ingredientRows)
        setLogs(logRows)
      })
      .catch(() => {
        if (!cancelled) setError("load-failed")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    const channel = supabase
      .channel("inventory-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ingredients" },
        (payload: RealtimePostgresChangesPayload<IngredientRow>) => {
          if (payload.eventType === "DELETE") {
            const oldId = (payload.old as { id?: string }).id
            if (!oldId) return
            setIngredients((prev) => prev.filter((i) => i.id !== oldId))
            return
          }
          const mapped = mapIngredientRow(payload.new as IngredientRow)
          setIngredients((prev) =>
            prev.some((i) => i.id === mapped.id)
              ? prev.map((i) => (i.id === mapped.id ? mapped : i))
              : [...prev, mapped]
          )
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inventory_logs" },
        (payload: RealtimePostgresChangesPayload<InventoryLogRow>) => {
          const row = payload.new as InventoryLogRow
          const ingredient = ingredientsRef.current.find((i) => i.id === row.ingredient_id)
          setLogs((prev) => [mapInventoryLogRow(row, ingredient?.nameVi ?? "", ingredient?.nameEn ?? ""), ...prev])
        }
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED" && status !== "CLOSED") {
          console.warn(`Inventory realtime subscription status: ${status}`)
        }
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
    // Runs once on mount; `supabase` is a stable client held in state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function restock(id: string) {
    const ingredient = ingredientsRef.current.find((i) => i.id === id)
    if (!ingredient) return
    await adjustStockQuery(supabase, id, ingredient.threshold, "restock")
  }

  async function adjustStock(id: string, change: number, reason: InventoryLogReason) {
    if (change === 0) return
    await adjustStockQuery(supabase, id, change, reason)
  }

  async function setOutOfStock(id: string) {
    const ingredient = ingredientsRef.current.find((i) => i.id === id)
    if (!ingredient) return
    await adjustStockQuery(supabase, id, -ingredient.stock, "adjustment")
  }

  async function addIngredient(input: IngredientInput) {
    await createIngredient(supabase, input)
  }

  async function updateIngredientDetails(id: string, input: IngredientInput) {
    await updateIngredientQuery(supabase, id, input)
  }

  return (
    <InventoryContext.Provider
      value={{
        ingredients,
        logs,
        isLoading,
        error,
        restock,
        adjustStock,
        setOutOfStock,
        addIngredient,
        updateIngredientDetails,
      }}
    >
      {children}
    </InventoryContext.Provider>
  )
}

export function useInventory(): InventoryContextValue {
  const ctx = useContext(InventoryContext)
  if (!ctx) throw new Error("useInventory must be used within an InventoryProvider")
  return ctx
}
