"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

export type OrderStatus = "preparing" | "ready" | "completed" | "cancelled"

export type OrderRecordItem = {
  nameVi: string
  nameEn: string
  quantity: number
  unitPrice: number
  note?: string
}

export type OrderRecord = {
  id: string
  createdAt: number
  orderType: "pickup" | "dine-in"
  table?: string
  items: OrderRecordItem[]
  subtotal: number
  discount: number
  total: number
  status: OrderStatus
}

/**
 * No `orders` table yet — seeded with fixed historical mock orders so
 * Order History has something to show on first load. Placing a real order
 * through Checkout prepends a genuine `OrderRecord` (real items, notes,
 * discount, table) via `addOrder`, so Order Tracking and Order History
 * both reflect what was actually ordered instead of a disconnected mock.
 */
const SEED_ORDERS: OrderRecord[] = [
  {
    id: "PDC-9821",
    createdAt: new Date(2026, 6, 5, 14, 32).getTime(),
    orderType: "pickup",
    items: [{ nameVi: "Phin Sữa Đá", nameEn: "Iced Milk Coffee", quantity: 1, unitPrice: 29000 }],
    subtotal: 29000,
    discount: 0,
    total: 29000,
    status: "preparing",
  },
  {
    id: "PDC-9815",
    createdAt: new Date(2026, 6, 5, 12, 15).getTime(),
    orderType: "dine-in",
    table: "2",
    items: [
      { nameVi: "Cà Phê Trứng", nameEn: "Egg Coffee", quantity: 1, unitPrice: 45000 },
      { nameVi: "Bánh Croissant Bơ", nameEn: "Butter Croissant", quantity: 1, unitPrice: 28000 },
    ],
    subtotal: 73000,
    discount: 0,
    total: 73000,
    status: "ready",
  },
  {
    id: "PDC-9788",
    createdAt: new Date(2026, 6, 3, 9, 45).getTime(),
    orderType: "pickup",
    items: [
      { nameVi: "Trà Vải", nameEn: "Lychee Tea", quantity: 1, unitPrice: 35000 },
      { nameVi: "Bánh Mì Que", nameEn: "Crispy Breadsticks", quantity: 1, unitPrice: 19000 },
    ],
    subtotal: 54000,
    discount: 0,
    total: 54000,
    status: "completed",
  },
  {
    id: "PDC-9750",
    createdAt: new Date(2026, 6, 1, 16, 20).getTime(),
    orderType: "pickup",
    items: [{ nameVi: "Bạc Xỉu", nameEn: "White Coffee", quantity: 1, unitPrice: 32000 }],
    subtotal: 32000,
    discount: 0,
    total: 32000,
    status: "cancelled",
  },
  {
    id: "PDC-9712",
    createdAt: new Date(2026, 5, 28, 8, 30).getTime(),
    orderType: "dine-in",
    table: "4",
    items: [
      { nameVi: "Phin Sữa Đá", nameEn: "Iced Milk Coffee", quantity: 2, unitPrice: 29000 },
      { nameVi: "Bánh Mì Que", nameEn: "Crispy Breadsticks", quantity: 1, unitPrice: 19000 },
    ],
    subtotal: 77000,
    discount: 0,
    total: 77000,
    status: "completed",
  },
]

type OrdersContextValue = {
  orders: OrderRecord[]
  addOrder: (order: OrderRecord) => void
}

const OrdersContext = createContext<OrdersContextValue | null>(null)

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<OrderRecord[]>(SEED_ORDERS)

  function addOrder(order: OrderRecord) {
    setOrders((prev) => [order, ...prev])
  }

  return <OrdersContext.Provider value={{ orders, addOrder }}>{children}</OrdersContext.Provider>
}

export function useOrders(): OrdersContextValue {
  const ctx = useContext(OrdersContext)
  if (!ctx) throw new Error("useOrders must be used within an OrdersProvider")
  return ctx
}
