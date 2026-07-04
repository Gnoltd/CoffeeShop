"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { ChevronRight } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { cn } from "@/lib/utils"
import { formatVND } from "@/lib/format"

type OrderStatus = "preparing" | "ready" | "completed" | "cancelled"
type MockOrderItem = { nameVi: string; nameEn: string }
type MockOrder = {
  id: string
  date: string
  status: OrderStatus
  items: MockOrderItem[]
  total: number
}

/**
 * No `orders` table yet — fixed mock history so this page demonstrates real
 * filtering/navigation instead of being a translated-heading placeholder.
 * Becomes a real Supabase query (+ Realtime for the active ones) once the
 * backend exists.
 */
const MOCK_ORDERS: MockOrder[] = [
  {
    id: "PDC-9821",
    date: "05/07/2026, 14:32",
    status: "preparing",
    items: [{ nameVi: "Phin Sữa Đá", nameEn: "Iced Milk Coffee" }],
    total: 29000,
  },
  {
    id: "PDC-9815",
    date: "05/07/2026, 12:15",
    status: "ready",
    items: [
      { nameVi: "Cà Phê Trứng", nameEn: "Egg Coffee" },
      { nameVi: "Bánh Croissant Bơ", nameEn: "Butter Croissant" },
    ],
    total: 73000,
  },
  {
    id: "PDC-9788",
    date: "03/07/2026, 09:45",
    status: "completed",
    items: [
      { nameVi: "Trà Vải", nameEn: "Lychee Tea" },
      { nameVi: "Bánh Mì Que", nameEn: "Crispy Breadsticks" },
    ],
    total: 54000,
  },
  {
    id: "PDC-9750",
    date: "01/07/2026, 16:20",
    status: "cancelled",
    items: [{ nameVi: "Bạc Xỉu", nameEn: "White Coffee" }],
    total: 32000,
  },
  {
    id: "PDC-9712",
    date: "28/06/2026, 08:30",
    status: "completed",
    items: [
      { nameVi: "Phin Sữa Đá", nameEn: "Iced Milk Coffee" },
      { nameVi: "Bánh Mì Que", nameEn: "Crispy Breadsticks" },
    ],
    total: 77000,
  },
]

const STATUS_STYLES: Record<OrderStatus, string> = {
  preparing: "bg-amber-100 text-amber-800",
  ready: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-muted text-muted-foreground",
}

const STATUS_KEYS: Record<OrderStatus, "statusPreparing" | "statusReady" | "statusCompleted" | "statusCancelled"> = {
  preparing: "statusPreparing",
  ready: "statusReady",
  completed: "statusCompleted",
  cancelled: "statusCancelled",
}

type Filter = "all" | "active" | "completed"

const FILTERS: { id: Filter; labelKey: "filterAll" | "filterActive" | "filterCompleted" }[] = [
  { id: "all", labelKey: "filterAll" },
  { id: "active", labelKey: "filterActive" },
  { id: "completed", labelKey: "filterCompleted" },
]

function matchesFilter(status: OrderStatus, filter: Filter): boolean {
  if (filter === "all") return true
  if (filter === "active") return status === "preparing" || status === "ready"
  return status === "completed" || status === "cancelled"
}

export function OrderHistory() {
  const locale = useLocale()
  const t = useTranslations("OrderHistory")
  const [filter, setFilter] = useState<Filter>("all")

  const filtered = MOCK_ORDERS.filter((order) => matchesFilter(order.status, filter))

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-4">
      <div className="mb-4 flex gap-1 rounded-lg bg-muted p-1">
        {FILTERS.map(({ id, labelKey }) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              "flex-1 rounded-md py-2 text-sm font-bold transition-all",
              filter === id ? "bg-card text-card-foreground shadow-sm" : "text-muted-foreground"
            )}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((order) => {
            const itemsLabel = order.items
              .map((item) => (locale === "vi" ? item.nameVi : item.nameEn))
              .join(", ")
            return (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-card-foreground">#{order.id}</span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold",
                        STATUS_STYLES[order.status]
                      )}
                    >
                      {t(STATUS_KEYS[order.status])}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{order.date}</p>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {t("itemCount", { count: order.items.length })}: {itemsLabel}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="font-bold text-primary">{formatVND(order.total)}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
