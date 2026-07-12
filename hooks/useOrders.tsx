"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel"
import { getMyOrders, getOrderForTracking, type OrderForTracking } from "@/lib/supabase/orders-data"

export type { OrderForTracking }
export type OrderStatus = OrderForTracking["status"]

type OrdersContextValue = {
  myOrders: OrderForTracking[]
  isLoadingMyOrders: boolean
  getOrder: (orderId: string) => Promise<OrderForTracking | null>
}

const OrdersContext = createContext<OrdersContextValue | null>(null)

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => createClient())
  const [myOrders, setMyOrders] = useState<OrderForTracking[]>([])
  const [isLoadingMyOrders, setIsLoadingMyOrders] = useState(true)

  useEffect(() => {
    let cancelled = false

    getMyOrders(supabase)
      .then((rows) => {
        if (!cancelled) setMyOrders(rows)
      })
      .catch(() => {
        // Order History is gated to logged-in customers already; an
        // error here (e.g. no session) just leaves the list empty.
      })
      .finally(() => {
        if (!cancelled) setIsLoadingMyOrders(false)
      })

    return () => {
      cancelled = true
    }
  }, [supabase])

  // Realtime confirms *that* a row visible to this session changed;
  // re-fetching the small "my orders" list is simpler and cheap enough
  // than hand-merging a partial payload against joined table/menu_item
  // names this component doesn't have inline.
  useRealtimeChannel(supabase, "my-orders-changes", [
    {
      table: "orders",
      event: "*",
      onChange: () => {
        getMyOrders(supabase).then(setMyOrders)
      },
    },
  ])

  async function getOrder(orderId: string): Promise<OrderForTracking | null> {
    return getOrderForTracking(supabase, orderId)
  }

  return (
    <OrdersContext.Provider value={{ myOrders, isLoadingMyOrders, getOrder }}>{children}</OrdersContext.Provider>
  )
}

export function useOrders(): OrdersContextValue {
  const ctx = useContext(OrdersContext)
  if (!ctx) throw new Error("useOrders must be used within an OrdersProvider")
  return ctx
}
