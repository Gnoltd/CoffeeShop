"use client"

import { useLocale, useTranslations } from "next-intl"
import { Play, CheckCircle2, PackageCheck, Utensils, ShoppingBag, ListTodo, RefreshCw, CheckCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import type { KdsStatus, KdsOrder } from "@/hooks/useKitchenOrders"

const COLUMNS: {
  status: KdsStatus
  headerClass: string
  labelKey: "columnNew" | "columnPreparing" | "columnReady"
  icon: typeof ListTodo
  iconClass?: string
}[] = [
  { status: "new", headerClass: "bg-zinc-500", labelKey: "columnNew", icon: ListTodo },
  { status: "preparing", headerClass: "bg-amber-600", labelKey: "columnPreparing", icon: RefreshCw, iconClass: "animate-spin [animation-duration:3s]" },
  { status: "ready", headerClass: "bg-green-600", labelKey: "columnReady", icon: CheckCheck },
]

export function formatElapsed(createdAt: number, now: number): string {
  const totalSeconds = Math.max(0, Math.floor((now - createdAt) / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

export function KitchenBoard({
  orders,
  now,
  onAdvance,
}: {
  orders: KdsOrder[]
  now: number
  onAdvance: (orderId: string) => void
}) {
  const locale = useLocale()
  const t = useTranslations("KitchenDisplay")

  return (
    <div className="grid h-full grid-cols-1 gap-4 overflow-hidden p-4 md:grid-cols-3">
      {COLUMNS.map((column) => {
        const columnOrders = orders.filter((o) => o.status === column.status)
        const Icon = column.icon
        return (
          <section
            key={column.status}
            className="flex h-full flex-col overflow-hidden rounded-xl border bg-muted"
          >
            <header className={cn("flex shrink-0 items-center justify-between p-4 text-white", column.headerClass)}>
              <h2 className="flex items-center gap-2 text-lg font-bold">
                {t(column.labelKey)}
                <span className="rounded bg-white/20 px-2 py-0.5 text-sm">{columnOrders.length}</span>
              </h2>
              <Icon className={cn("h-5 w-5", column.iconClass)} />
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto p-3">
              {columnOrders.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">{t("empty")}</p>
              )}
              {columnOrders.map((order) => {
                const isReady = column.status === "ready"
                return (
                  <div key={order.id} className="rounded-xl border bg-card shadow-sm">
                    <div
                      className={cn(
                        "flex items-start justify-between border-b p-3",
                        isReady && "bg-green-50 dark:bg-green-950/20"
                      )}
                    >
                      <div>
                        <h3 className="text-xl font-black text-card-foreground">#{order.id}</h3>
                        <span
                          className={cn(
                            "mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold",
                            order.orderType === "pickup"
                              ? "bg-primary text-primary-foreground"
                              : "border bg-muted text-card-foreground"
                          )}
                        >
                          {order.orderType === "pickup" ? (
                            <ShoppingBag className="h-3 w-3" />
                          ) : (
                            <Utensils className="h-3 w-3" />
                          )}
                          {order.orderType === "pickup" ? t("pickup") : t("table", { table: order.table ?? "" })}
                        </span>
                      </div>
                      <div className="text-right">
                        {isReady ? (
                          <div className="text-xl font-bold text-green-600">{t("doneLabel")}</div>
                        ) : (
                          <>
                            <div
                              className={cn(
                                "text-xl font-bold",
                                column.status === "new" && "text-primary",
                                column.status === "preparing" && "text-amber-600"
                              )}
                            >
                              {formatElapsed(order.createdAt, now)}
                            </div>
                            <div className="text-[10px] font-bold uppercase text-muted-foreground">
                              {column.status === "new" ? t("elapsedTimeCaption") : t("preparingTimeCaption")}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2 p-3">
                      {order.items.map((item, index) => (
                        <div key={index} className="flex items-start gap-3">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold text-card-foreground">
                            {item.quantity}x
                          </div>
                          <div>
                            <p
                              className={cn(
                                "font-bold text-card-foreground",
                                isReady && "text-muted-foreground line-through decoration-muted-foreground"
                              )}
                            >
                              {locale === "vi" ? item.nameVi : item.nameEn}
                            </p>
                            {item.noteVi && (
                              <p className="text-sm font-medium italic text-secondary">
                                {locale === "vi" ? item.noteVi : item.noteEn}
                              </p>
                            )}
                            {item.isSignature && (
                              <span className="mt-1 inline-block rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                                {t("signatureItem")}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => onAdvance(order.id)}
                      className={cn(
                        "flex w-full items-center justify-center gap-2 rounded-b-xl py-3 text-base font-bold text-white transition-all active:scale-[0.99]",
                        column.status === "new" && "bg-primary hover:brightness-110",
                        column.status === "preparing" && "bg-amber-600 hover:brightness-110",
                        column.status === "ready" && "bg-green-600 hover:brightness-110"
                      )}
                    >
                      {column.status === "new" && (
                        <>
                          <Play className="h-4 w-4" /> {t("startPreparing")}
                        </>
                      )}
                      {column.status === "preparing" && (
                        <>
                          <CheckCircle2 className="h-4 w-4" /> {t("markReady")}
                        </>
                      )}
                      {column.status === "ready" && (
                        <>
                          <PackageCheck className="h-4 w-4" /> {t("complete")}
                        </>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
