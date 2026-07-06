"use client"

import { useEffect, useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Coffee, CupSoda, Cookie, Milk, Search, Minus, Plus, Trash2, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatVND } from "@/lib/format"
import { createClient } from "@/lib/supabase/client"
import type { MenuCategory, MenuIcon, MenuItem } from "@/lib/supabase/menu-data"
import { useTables } from "@/hooks/useTables"
import { useKitchenOrders } from "@/hooks/useKitchenOrders"
import { KitchenPendingPayment } from "@/components/staff/kitchen-pending-payment"

const ICONS: Record<MenuIcon, typeof Coffee> = {
  coffee: Coffee,
  "cup-soda": CupSoda,
  cookie: Cookie,
  milk: Milk,
}

const TAX_RATE = 0.08

type OrderLine = {
  menuItemId: string
  nameVi: string
  nameEn: string
  unitPrice: number
  quantity: number
}

type OrderType = "dine-in" | "takeaway"
type PaymentMethod = "cash" | "card" | "vnpay"

export function PosTerminal({ categories, items }: { categories: MenuCategory[]; items: MenuItem[] }) {
  const locale = useLocale()
  const t = useTranslations("Pos")
  const [supabase] = useState(() => createClient())
  const { tables } = useTables()
  const { pendingPaymentOrders, confirmCashPayment } = useKitchenOrders()

  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.id ?? "")
  const [searchQuery, setSearchQuery] = useState("")
  const [order, setOrder] = useState<OrderLine[]>([])
  const [orderType, setOrderType] = useState<OrderType>("dine-in")
  const [selectedTableId, setSelectedTableId] = useState(tables[0]?.id ?? "")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash")
  const [isCharging, setIsCharging] = useState(false)
  const [chargeError, setChargeError] = useState<string | null>(null)

  const selectedTable = tables.find((tbl) => tbl.id === selectedTableId) ?? tables[0]

  useEffect(() => {
    if (!selectedTableId && tables.length > 0) {
      setSelectedTableId(tables[0].id)
    }
  }, [tables, selectedTableId])

  const name = (item: MenuItem) => (locale === "vi" ? item.nameVi : item.nameEn)
  const categoryLabel = (c: MenuCategory) => (locale === "vi" ? c.nameVi : c.nameEn)

  const visibleItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return items.filter((item) => {
      const matchesCategory = item.categoryId === selectedCategory
      const matchesQuery =
        query === "" || item.nameVi.toLowerCase().includes(query) || item.nameEn.toLowerCase().includes(query)
      return item.isAvailable && matchesCategory && matchesQuery
    })
  }, [items, selectedCategory, searchQuery])

  function addToOrder(item: MenuItem) {
    setOrder((prev) => {
      const existing = prev.find((line) => line.menuItemId === item.id)
      if (existing) {
        return prev.map((line) =>
          line.menuItemId === item.id ? { ...line, quantity: line.quantity + 1 } : line
        )
      }
      return [
        ...prev,
        { menuItemId: item.id, nameVi: item.nameVi, nameEn: item.nameEn, unitPrice: item.basePrice, quantity: 1 },
      ]
    })
  }

  function updateQuantity(menuItemId: string, quantity: number) {
    setOrder((prev) =>
      quantity <= 0
        ? prev.filter((line) => line.menuItemId !== menuItemId)
        : prev.map((line) => (line.menuItemId === menuItemId ? { ...line, quantity } : line))
    )
  }

  const subtotal = order.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)
  const tax = Math.round(subtotal * TAX_RATE)
  const total = subtotal + tax

  async function handleCharge() {
    if (order.length === 0) return
    setChargeError(null)
    setIsCharging(true)
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("place-order", {
        body: {
          orderType: orderType === "dine-in" ? "dine-in" : "pickup",
          tableId: orderType === "dine-in" ? (selectedTable?.id ?? null) : null,
          pickupTime: null,
          paymentMethod: "cash",
          promoCode: null,
          redeemLoyaltyPoints: 0,
          paymentCollected: true,
          items: order.map((line) => ({
            menuItemId: line.menuItemId,
            sizeId: null,
            modifierIds: [],
            quantity: line.quantity,
            note: null,
          })),
        },
      })
      if (invokeError || data?.error) throw invokeError ?? new Error(data.error)
      setOrder([])
    } catch {
      setChargeError(t("chargeError"))
    } finally {
      setIsCharging(false)
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b p-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-10 w-full rounded-lg border-none bg-muted pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {pendingPaymentOrders.length > 0 && (
          <div className="px-4 pt-4">
            <KitchenPendingPayment orders={pendingPaymentOrders} onConfirm={confirmCashPayment} />
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto px-4 pt-4">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedCategory(category.id)}
              className={cn(
                "whitespace-nowrap rounded-lg px-5 py-2.5 text-sm font-bold transition-colors",
                selectedCategory === category.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-card-foreground hover:bg-accent/30"
              )}
            >
              {categoryLabel(category)}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
            {visibleItems.map((item) => {
              const Icon = ICONS[item.icon]
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addToOrder(item)}
                  className="flex flex-col gap-2 rounded-xl border bg-card p-2 text-left shadow-sm transition-all hover:shadow-md active:scale-95"
                >
                  <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="h-8 w-8" />
                  </div>
                  <div className="px-1 pb-1">
                    <h3 className="line-clamp-1 font-bold text-card-foreground">{name(item)}</h3>
                    <p className="mt-1 text-lg font-bold text-primary">{formatVND(item.basePrice)}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <aside className="flex w-[380px] shrink-0 flex-col border-l bg-muted">
        <div className="flex items-center justify-between border-b bg-card p-4">
          <h2 className="text-lg font-bold text-card-foreground">{t("orderTitle")}</h2>
          {order.length > 0 && (
            <button
              type="button"
              onClick={() => setOrder([])}
              className="rounded-lg p-2 text-destructive transition-colors hover:bg-destructive/10"
              aria-label={t("clearOrder")}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {order.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("emptyOrder")}</p>
          ) : (
            <div className="flex flex-col gap-4">
              {order.map((line) => (
                <div key={line.menuItemId} className="flex flex-col gap-2">
                  <div className="flex items-start justify-between">
                    <h4 className="font-bold text-card-foreground">
                      {locale === "vi" ? line.nameVi : line.nameEn}
                    </h4>
                    <p className="font-bold text-primary">{formatVND(line.unitPrice * line.quantity)}</p>
                  </div>
                  <div className="flex items-center gap-2 self-start rounded-lg bg-card p-1">
                    <button
                      type="button"
                      onClick={() => updateQuantity(line.menuItemId, line.quantity - 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center font-bold">{line.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(line.menuItemId, line.quantity + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-secondary-foreground transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 border-t bg-card p-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {t("type")}
              </label>
              <div className="flex rounded-lg bg-muted p-1">
                <button
                  type="button"
                  onClick={() => setOrderType("dine-in")}
                  className={cn(
                    "flex-1 rounded-md py-2 text-xs font-bold transition-all",
                    orderType === "dine-in" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
                  )}
                >
                  {t("dineIn")}
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType("takeaway")}
                  className={cn(
                    "flex-1 rounded-md py-2 text-xs font-bold transition-all",
                    orderType === "takeaway" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
                  )}
                >
                  {t("takeaway")}
                </button>
              </div>
            </div>
            {orderType === "dine-in" && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {t("table")}
                </label>
                <select
                  value={selectedTableId}
                  onChange={(e) => setSelectedTableId(e.target.value)}
                  className="h-full rounded-lg border-none bg-muted px-3 text-xs font-bold outline-none"
                >
                  {tables.map((tbl) => (
                    <option key={tbl.id} value={tbl.id}>
                      {t("table")} {tbl.number}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {t("payment")}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["cash", "card", "vnpay"] as PaymentMethod[]).map((method) => {
                const enabled = method === "cash"
                return (
                  <button
                    key={method}
                    type="button"
                    disabled={!enabled}
                    title={enabled ? undefined : t("paymentMethodComingSoon")}
                    onClick={() => setPaymentMethod(method)}
                    className={cn(
                      "rounded-lg border-2 py-2.5 text-[11px] font-bold transition-all",
                      paymentMethod === method
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-transparent bg-muted text-muted-foreground",
                      !enabled && "opacity-50"
                    )}
                  >
                    {method === "cash" ? t("payCash") : method === "card" ? t("payCard") : "VNPay"}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>{t("subtotal")}</span>
              <span className="font-bold text-card-foreground">{formatVND(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("tax")}</span>
              <span className="font-bold text-card-foreground">{formatVND(tax)}</span>
            </div>
          </div>

          {chargeError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{chargeError}</p>
          )}

          <button
            type="button"
            onClick={handleCharge}
            disabled={order.length === 0 || isCharging}
            className="flex items-center justify-between rounded-xl bg-primary px-5 py-4 text-primary-foreground shadow-lg transition-transform active:scale-95 disabled:opacity-50"
          >
            <span className="flex flex-col items-start">
              <span className="text-[10px] font-bold uppercase opacity-80">{t("charge")}</span>
              <span className="text-lg font-bold">{formatVND(total)}</span>
            </span>
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </aside>
    </div>
  )
}
