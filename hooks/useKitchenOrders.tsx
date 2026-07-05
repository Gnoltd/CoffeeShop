"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

export type KdsStatus = "new" | "preparing" | "ready"

export type KdsOrderItem = {
  quantity: number
  nameVi: string
  nameEn: string
  noteVi?: string
  noteEn?: string
  isSignature?: boolean
}

export type KdsOrder = {
  id: string
  orderType: "dine-in" | "pickup"
  table?: string
  items: KdsOrderItem[]
  status: KdsStatus
  createdAt: number
}

/**
 * No orders table / Realtime yet — this board is seeded with fixed mock
 * orders and only tracks status transitions in shared in-memory state
 * (Context, not localStorage — matches POS/KDS's existing "resets on
 * reload" behavior, just now shared across /staff/pos and /staff/orders
 * instead of two disconnected copies). Once Supabase exists, this becomes
 * a Realtime subscription on `orders` filtered by status, per the design
 * spec's Section 3d.
 */
const INITIAL_ORDERS: KdsOrder[] = [
  {
    id: "8829",
    orderType: "dine-in",
    table: "04",
    status: "new",
    createdAt: Date.now() - 45 * 1000,
    items: [
      { quantity: 2, nameVi: "Phin Sữa Đá", nameEn: "Iced Milk Coffee", noteVi: "Ít sữa, thêm đá", noteEn: "Less milk, extra ice" },
      { quantity: 1, nameVi: "Bánh Mì Que", nameEn: "Crispy Breadsticks", noteVi: "Pate nhiều", noteEn: "Extra pate" },
    ],
  },
  {
    id: "8831",
    orderType: "pickup",
    status: "new",
    createdAt: Date.now() - 12 * 1000,
    items: [{ quantity: 1, nameVi: "Cà Phê Muối", nameEn: "Salted Coffee" }],
  },
  {
    id: "8825",
    orderType: "dine-in",
    table: "07",
    status: "preparing",
    createdAt: Date.now() - 4 * 60 * 1000 - 32 * 1000,
    items: [
      { quantity: 3, nameVi: "Bạc Xỉu", nameEn: "White Coffee", noteVi: "Nhiều cốt dừa", noteEn: "Extra coconut milk" },
      { quantity: 1, nameVi: "Cà Phê Trứng", nameEn: "Egg Coffee", isSignature: true },
    ],
  },
  {
    id: "8812",
    orderType: "pickup",
    status: "ready",
    createdAt: Date.now() - 9 * 60 * 1000,
    items: [{ quantity: 1, nameVi: "Trà Sen Vàng", nameEn: "Lotus Tea" }],
  },
]

export const NEXT_STATUS: Record<KdsStatus, KdsStatus | null> = {
  new: "preparing",
  preparing: "ready",
  ready: null,
}

type KitchenOrdersContextValue = {
  orders: KdsOrder[]
  addOrder: (order: KdsOrder) => void
  advance: (orderId: string) => void
}

const KitchenOrdersContext = createContext<KitchenOrdersContextValue | null>(null)

export function KitchenOrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<KdsOrder[]>(INITIAL_ORDERS)

  function addOrder(order: KdsOrder) {
    setOrders((prev) => [...prev, order])
  }

  function advance(orderId: string) {
    setOrders((prev) => {
      const order = prev.find((o) => o.id === orderId)
      if (!order) return prev
      const next = NEXT_STATUS[order.status]
      if (!next) return prev.filter((o) => o.id !== orderId)
      return prev.map((o) => (o.id === orderId ? { ...o, status: next } : o))
    })
  }

  return (
    <KitchenOrdersContext.Provider value={{ orders, addOrder, advance }}>
      {children}
    </KitchenOrdersContext.Provider>
  )
}

export function useKitchenOrders(): KitchenOrdersContextValue {
  const ctx = useContext(KitchenOrdersContext)
  if (!ctx) throw new Error("useKitchenOrders must be used within a KitchenOrdersProvider")
  return ctx
}
