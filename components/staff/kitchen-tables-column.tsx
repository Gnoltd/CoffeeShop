"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Bell, CircleCheck, Sparkles, User, Utensils, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTables } from "@/hooks/useTables"
import { useKitchenOrders } from "@/hooks/useKitchenOrders"

export function KitchenTablesColumn({ active }: { active: boolean }) {
  const locale = useLocale()
  const t = useTranslations("KitchenDisplay")
  const { tables, setStatus } = useTables()
  const { orders, serveTable, confirmCashPayment, markCashPayment, undoCashPayment } = useKitchenOrders()
  const [error, setError] = useState<string | null>(null)

  return (
    <section
      className={cn(
        "h-full flex-col overflow-hidden rounded-xl border bg-muted",
        active ? "flex" : "hidden",
        "md:flex"
      )}
    >
      <header className="flex shrink-0 items-center justify-between bg-zinc-600 p-4 text-white">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          {t("columnTables")}
          <span className="rounded bg-white/20 px-2 py-0.5 text-sm">{tables.length}</span>
        </h2>
      </header>
      {error && (
        <p className="mx-3 mt-2 shrink-0 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
      )}
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {tables.map((table) => {
          const location = locale === "vi" ? table.locationVi : table.locationEn
          const tableOrders = orders.filter((o) => o.tableId === table.id)
          const readyOrderIds = tableOrders.filter((o) => o.status === "ready").map((o) => o.id)
          const awaitingPaymentOrder = tableOrders.find((o) => o.status === "served" && o.paymentStatus === "pending")

          return (
            <div
              key={table.id}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg border p-3",
                table.status === "available" && "bg-green-50 dark:bg-green-950/20",
                table.status === "occupied" && "bg-red-50 dark:bg-red-950/20",
                table.status === "cleaning" && "bg-amber-50 dark:bg-amber-950/20"
              )}
            >
              <div>
                <p className="font-bold text-card-foreground">{table.number}</p>
                {location && <p className="text-xs text-muted-foreground">{location}</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    const next = table.status === "available" ? "occupied" : table.status === "occupied" ? "cleaning" : "available"
                    setStatus(table.id, next).catch(() => setError(t("updateError")))
                  }}
                  title={
                    table.status === "available"
                      ? t("markOccupied")
                      : table.status === "occupied"
                        ? t("markCleaning")
                        : t("cleaningDone")
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold transition-colors",
                    table.status === "available" && "bg-green-100 text-green-700 hover:bg-green-200",
                    table.status === "occupied" && "bg-red-100 text-red-700 hover:bg-red-200",
                    table.status === "cleaning" && "bg-amber-100 text-amber-700 hover:bg-amber-200"
                  )}
                >
                  {table.status === "available" && <CircleCheck className="h-4 w-4" />}
                  {table.status === "occupied" && <User className="h-4 w-4" />}
                  {table.status === "cleaning" && <Sparkles className="h-4 w-4" />}
                  {table.status === "available"
                    ? t("tableAvailable")
                    : table.status === "occupied"
                      ? t("tableOccupied")
                      : t("tableCleaning")}
                </button>
                {table.status === "cleaning" && table.cleaningNotifiedAt && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-destructive">
                    <Bell className="h-3 w-3 animate-pulse" />
                    {t("guestNotified")}
                  </span>
                )}
                {awaitingPaymentOrder && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700">
                    <Wallet className="h-3 w-3" />
                    {t("tableAwaitingPayment")}
                  </span>
                )}
                {readyOrderIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      serveTable(readyOrderIds).catch(() => setError(t("updateError")))
                    }}
                    className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:brightness-110"
                  >
                    <Utensils className="h-3 w-3" />
                    {t("markServed")}
                  </button>
                )}
                {awaitingPaymentOrder?.paymentMethod === "cash" && (
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null)
                        confirmCashPayment(awaitingPaymentOrder.id).catch(() => setError(t("updateError")))
                      }}
                      className="rounded-lg bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground hover:brightness-110"
                    >
                      {t("confirmCashReceived")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null)
                        undoCashPayment(awaitingPaymentOrder.id).catch(() => setError(t("updateError")))
                      }}
                      className="rounded-lg border px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted"
                    >
                      {t("undoCash")}
                    </button>
                  </div>
                )}
                {awaitingPaymentOrder && awaitingPaymentOrder.paymentMethod === null && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      markCashPayment(awaitingPaymentOrder.id).catch(() => setError(t("updateError")))
                    }}
                    className="rounded-lg bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground hover:brightness-110"
                  >
                    {t("markCash")}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
