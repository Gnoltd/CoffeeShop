"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export type CartModifier = {
  groupId: string
  optionId: string
  labelVi: string
  labelEn: string
  priceDelta: number
}

export type CartItem = {
  cartItemId: string
  menuItemId: string
  nameVi: string
  nameEn: string
  size?: { id: string; label: string; priceDelta: number }
  modifiers: CartModifier[]
  unitPrice: number
  quantity: number
}

type AddToCartInput = Omit<CartItem, "cartItemId" | "quantity">

type CartContextValue = {
  items: CartItem[]
  addItem: (item: AddToCartInput, quantity?: number) => void
  updateQuantity: (cartItemId: string, quantity: number) => void
  removeItem: (cartItemId: string) => void
  clear: () => void
  subtotal: number
  itemCount: number
}

const CartContext = createContext<CartContextValue | null>(null)

const STORAGE_KEY = "phadincoffee-cart"

function buildCartItemId(item: AddToCartInput): string {
  const modifierKey = item.modifiers
    .map((m) => m.optionId)
    .sort()
    .join(",")
  return [item.menuItemId, item.size?.id ?? "no-size", modifierKey].join("|")
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored) setItems(JSON.parse(stored))
    } catch {
      // ignore malformed/unavailable storage
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items, hydrated])

  function addItem(item: AddToCartInput, quantity = 1) {
    const cartItemId = buildCartItemId(item)
    setItems((prev) => {
      const existing = prev.find((i) => i.cartItemId === cartItemId)
      if (existing) {
        return prev.map((i) =>
          i.cartItemId === cartItemId ? { ...i, quantity: i.quantity + quantity } : i
        )
      }
      return [...prev, { ...item, cartItemId, quantity }]
    })
  }

  function updateQuantity(cartItemId: string, quantity: number) {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.cartItemId !== cartItemId)
        : prev.map((i) => (i.cartItemId === cartItemId ? { ...i, quantity } : i))
    )
  }

  function removeItem(cartItemId: string) {
    setItems((prev) => prev.filter((i) => i.cartItemId !== cartItemId))
  }

  function clear() {
    setItems([])
  }

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [items]
  )
  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  )

  return (
    <CartContext.Provider
      value={{ items, addItem, updateQuantity, removeItem, clear, subtotal, itemCount }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used within a CartProvider")
  return ctx
}
