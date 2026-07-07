"use client"

import { useLocale, useTranslations } from "next-intl"
import { Bell, CircleCheck, Sparkles, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTables } from "@/hooks/useTables"

export function KitchenTablesColumn() {
  const locale = useLocale()
  const t = useTranslations("KitchenDisplay")
  const { tables, setStatus } = useTables()

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-xl border bg-muted">
      <header className="flex shrink-0 items-center justify-between bg-zinc-600 p-4 text-white">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          {t("columnTables")}
          <span className="rounded bg-white/20 px-2 py-0.5 text-sm">{tables.length}</span>
        </h2>
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {tables.map((table) => {
          const location = locale === "vi" ? table.locationVi : table.locationEn
          return (
            <div
              key={table.id}
              className={cn(
                "flex items-center justify-between rounded-lg border p-3",
                table.status === "available" && "bg-green-50 dark:bg-green-950/20",
                table.status === "occupied" && "bg-red-50 dark:bg-red-950/20",
                table.status === "cleaning" && "bg-amber-50 dark:bg-amber-950/20"
              )}
            >
              <div>
                <p className="font-bold text-card-foreground">{table.number}</p>
                {location && <p className="text-xs text-muted-foreground">{location}</p>}
                <span
                  className={cn(
                    "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
                    table.status === "available" && "bg-green-100 text-green-700",
                    table.status === "occupied" && "bg-red-100 text-red-700",
                    table.status === "cleaning" && "bg-amber-100 text-amber-700"
                  )}
                >
                  {table.status === "available" && <CircleCheck className="h-3 w-3" />}
                  {table.status === "occupied" && <User className="h-3 w-3" />}
                  {table.status === "cleaning" && <Sparkles className="h-3 w-3" />}
                  {table.status === "available"
                    ? t("tableAvailable")
                    : table.status === "occupied"
                      ? t("tableOccupied")
                      : t("tableCleaning")}
                </span>
                {table.status === "cleaning" && table.cleaningNotifiedAt && (
                  <span className="mt-1 flex items-center gap-1 text-[10px] font-bold text-destructive">
                    <Bell className="h-3 w-3 animate-pulse" />
                    {t("guestNotified")}
                  </span>
                )}
              </div>
              {table.status === "cleaning" && (
                <button
                  type="button"
                  onClick={() => setStatus(table.id, "available")}
                  className="shrink-0 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:brightness-110"
                >
                  {t("cleaningDone")}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
