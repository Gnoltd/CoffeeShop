"use client"

import {
  CookingPot,
  Check,
  PackageCheck,
  CircleCheckBig,
  Clock,
  TableIcon,
  ShoppingBag,
  Store,
  Phone,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { formatVND } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useOrders, type OrderRecord, type OrderStatus } from "@/hooks/useOrders"

/**
 * No `orders` table / Realtime yet. Looks up the real order placed through
 * Checkout (hooks/useOrders.tsx) by id — real items, notes, discount, and
 * table when found. Falls back to a fixed mock order (matching the
 * approved Stitch mockup's example numbers) for any id not in the local
 * store, e.g. a stale link or a directly-typed URL.
 */
const MOCK_SHOP_PHONE = "+84281234567"

const FALLBACK_ORDER: Omit<OrderRecord, "id" | "table"> = {
  createdAt: Date.now(),
  orderType: "dine-in",
  items: [
    { nameVi: "Phin Sữa Đá", nameEn: "Iced Milk Coffee", quantity: 1, unitPrice: 35000 },
    { nameVi: "Bánh Mì Que", nameEn: "Crispy Breadsticks", quantity: 2, unitPrice: 15000 },
  ],
  subtotal: 65000,
  discount: 5000,
  total: 60000,
  status: "preparing",
}

const STEPS = [
  { key: "stepPaid", icon: Check },
  { key: "stepPreparing", icon: CookingPot },
  { key: "stepReady", icon: PackageCheck },
  { key: "stepCompleted", icon: CircleCheckBig },
] as const

const STATUS_STEP: Record<OrderStatus, number> = {
  preparing: 1,
  ready: 2,
  completed: 3,
  cancelled: 0,
}

const STATUS_LABEL_KEY: Record<OrderStatus, "statusPreparing" | "statusReady" | "statusCompleted" | "statusCancelled"> = {
  preparing: "statusPreparing",
  ready: "statusReady",
  completed: "statusCompleted",
  cancelled: "statusCancelled",
}

export function OrderTracking({ orderId, table }: { orderId: string; table?: string }) {
  const locale = useLocale()
  const t = useTranslations("OrderTracking")
  const { orders } = useOrders()

  const found = orders.find((o) => o.id === orderId)
  const order: OrderRecord = found ?? { ...FALLBACK_ORDER, id: orderId, table: table ?? "04" }

  const currentStep = STATUS_STEP[order.status]
  const progressPercent = (currentStep / (STEPS.length - 1)) * 100

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4 sm:px-6">
      <section className="relative overflow-hidden rounded-xl border bg-muted p-6 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-secondary">{t("orderId")}</p>
        <h2 className="mb-4 text-3xl font-bold text-primary">#{order.id}</h2>
        <div className="mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-primary/15">
          <CookingPot className="h-12 w-12 text-primary" />
        </div>
        <h3 className="mb-1 text-xl font-semibold text-card-foreground">{t(STATUS_LABEL_KEY[order.status])}</h3>
        {order.status === "preparing" && (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 text-primary" />
            {t("etaLabel")}
          </p>
        )}
      </section>

      <section className="mt-8 px-2">
        <div className="relative flex items-start justify-between">
          <div className="absolute top-5 left-0 h-1 w-full -z-0 bg-border" />
          <div
            className="absolute top-5 left-0 -z-0 h-1 bg-primary transition-all duration-1000"
            style={{ width: `${progressPercent}%` }}
          />
          {STEPS.map((step, index) => {
            const Icon = step.icon
            const isDone = index <= currentStep
            return (
              <div key={step.key} className="z-10 flex w-1/4 flex-col items-center gap-2">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full shadow-sm",
                    isDone ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <p
                  className={cn(
                    "text-center text-[10px] font-bold leading-tight",
                    isDone ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {t(step.key)}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary/20 text-secondary">
            {order.orderType === "dine-in" ? <TableIcon className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}
          </div>
          <div>
            <h4 className="text-sm font-bold text-card-foreground">
              {order.orderType === "dine-in" ? t("tableLabel", { table: order.table ?? "" }) : t("pickupBadge")}
            </h4>
            {order.orderType === "dine-in" && (
              <p className="text-xs text-muted-foreground">{t("dineInBadge")}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent/30 text-accent-foreground">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-card-foreground">{t("branchName")}</h4>
          </div>
        </div>
      </section>

      <section className="mt-8 space-y-3">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="text-lg font-semibold text-card-foreground">{t("orderDetails")}</h3>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-secondary">
            {t("itemCount", { count: order.items.length })}
          </span>
        </div>
        <div className="space-y-2">
          {order.items.map((item, index) => (
            <div key={index} className="flex items-center justify-between rounded-xl p-3">
              <div>
                <h5 className="font-bold text-card-foreground">
                  {item.quantity}x {locale === "vi" ? item.nameVi : item.nameEn}
                </h5>
                {item.note && <p className="text-xs italic text-accent-foreground">+ {item.note}</p>}
              </div>
              <span className="text-sm font-bold text-primary">{formatVND(item.unitPrice * item.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="space-y-2 rounded-xl bg-muted p-4">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{t("subtotal")}</span>
            <span>{formatVND(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{t("discount")}</span>
            <span className="text-destructive">-{formatVND(order.discount)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t pt-2">
            <span className="font-bold text-card-foreground">{t("total")}</span>
            <span className="text-xl font-black text-primary">{formatVND(order.total)}</span>
          </div>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 p-4 backdrop-blur-md">
        <a
          href={`tel:${MOCK_SHOP_PHONE}`}
          className="mx-auto flex max-w-2xl items-center justify-center gap-2 rounded-xl bg-primary py-4 font-bold text-primary-foreground shadow-lg transition-transform active:scale-95"
        >
          <Phone className="h-5 w-5" />
          {t("contactShop")}
        </a>
      </div>
    </div>
  )
}
