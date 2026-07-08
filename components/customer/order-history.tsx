"use client"

import { useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { ChevronRight } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { cn } from "@/lib/utils"
import { formatOrderId, formatVND } from "@/lib/format"
import { useOrders, type OrderStatus } from "@/hooks/useOrders"

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending_payment: "bg-muted text-muted-foreground",
  paid: "bg-blue-100 text-blue-800",
  preparing: "bg-amber-100 text-amber-800",
  ready: "bg-blue-100 text-blue-800",
  served: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-muted text-muted-foreground",
}

const STATUS_KEYS: Record<
  OrderStatus,
  "statusPendingPayment" | "statusPaid" | "statusPreparing" | "statusReady" | "statusServed" | "statusCompleted" | "statusCancelled"
> = {
  pending_payment: "statusPendingPayment",
  paid: "statusPaid",
  preparing: "statusPreparing",
  ready: "statusReady",
  served: "statusServed",
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
  if (filter === "active")
    return status === "pending_payment" || status === "paid" || status === "preparing" || status === "ready" || status === "served"
  return status === "completed" || status === "cancelled"
}

function formatOrderDate(timestamp: number, locale: string): string {
  return new Date(timestamp).toLocaleString(locale === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

export function OrderHistory() {
  const locale = useLocale()
  const t = useTranslations("OrderHistory")
  const { myOrders, isLoadingMyOrders } = useOrders()
  const [filter, setFilter] = useState<Filter>("all")

  const sorted = useMemo(() => [...myOrders].sort((a, b) => b.createdAt - a.createdAt), [myOrders])
  const filtered = sorted.filter((order) => matchesFilter(order.status, filter))

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

      {isLoadingMyOrders ? (
        <p className="py-16 text-center text-muted-foreground">{t("loading")}</p>
      ) : filtered.length === 0 ? (
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
                    <span className="font-bold text-card-foreground">#{formatOrderId(order.id)}</span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold",
                        STATUS_STYLES[order.status]
                      )}
                    >
                      {t(STATUS_KEYS[order.status])}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{formatOrderDate(order.createdAt, locale)}</p>
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
