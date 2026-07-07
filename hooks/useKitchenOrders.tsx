"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  advanceOrderStatus,
  confirmCashPayment as confirmCashPaymentQuery,
  getKitchenOrders,
  getPendingPaymentOrders,
  type KdsOrderRow,
  type RealOrderStatus,
} from "@/lib/supabase/orders-data"

export type KdsStatus = "paid" | "preparing" | "ready"
export type { KdsOrderRow as KdsOrder }

export const NEXT_STATUS: Record<KdsStatus, RealOrderStatus | null> = {
  paid: "preparing",
  preparing: "ready",
  ready: "completed",
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

type KitchenOrdersContextValue = {
  orders: KdsOrderRow[]
  pendingPaymentOrders: KdsOrderRow[]
  isLoading: boolean
  advance: (orderId: string) => Promise<void>
  confirmCashPayment: (orderId: string) => Promise<void>
  completedCount: number
  avgTimeLabel: string
}

const KitchenOrdersContext = createContext<KitchenOrdersContextValue | null>(null)

export function KitchenOrdersProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => createClient())
  const [orders, setOrders] = useState<KdsOrderRow[]>([])
  const [pendingPaymentOrders, setPendingPaymentOrders] = useState<KdsOrderRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [completedCount, setCompletedCount] = useState(0)
  const [completedDurations, setCompletedDurations] = useState<number[]>([])

  async function refetch() {
    const [active, pending] = await Promise.all([getKitchenOrders(supabase), getPendingPaymentOrders(supabase)])
    setOrders(active)
    setPendingPaymentOrders(pending)
  }

  useEffect(() => {
    let cancelled = false

    refetch().finally(() => {
      if (!cancelled) setIsLoading(false)
    })

    const channel = supabase
      .channel("kitchen-orders-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        // Staff sees every order (orders_select_staff has no per-row
        // filtering concerns), so a plain refetch on any change is both
        // correct and simple — the board is small enough this is cheap.
        if (!cancelled) refetch()
      })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED" && status !== "CLOSED") {
          console.warn(`Kitchen orders realtime subscription status: ${status}`)
        }
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function advance(orderId: string) {
    const order = orders.find((o) => o.id === orderId)
    if (!order) return
    const next = NEXT_STATUS[order.status as KdsStatus]
    if (!next) return
    if (order.status === "ready") {
      setCompletedCount((count) => count + 1)
      setCompletedDurations((durations) => [...durations, Date.now() - order.createdAt])
    }
    await advanceOrderStatus(supabase, orderId, next)
  }

  async function confirmCashPayment(orderId: string) {
    await confirmCashPaymentQuery(supabase, orderId)
  }

  const avgTimeLabel =
    completedDurations.length === 0
      ? "--:--"
      : formatDuration(completedDurations.reduce((sum, d) => sum + d, 0) / completedDurations.length)

  return (
    <KitchenOrdersContext.Provider
      value={{ orders, pendingPaymentOrders, isLoading, advance, confirmCashPayment, completedCount, avgTimeLabel }}
    >
      {children}
    </KitchenOrdersContext.Provider>
  )
}

export function useKitchenOrders(): KitchenOrdersContextValue {
  const ctx = useContext(KitchenOrdersContext)
  if (!ctx) throw new Error("useKitchenOrders must be used within a KitchenOrdersProvider")
  return ctx
}
