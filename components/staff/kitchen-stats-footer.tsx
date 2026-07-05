"use client"

import { useLocale, useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import type { KdsOrder } from "@/hooks/useKitchenOrders"

type LoadLevel = "light" | "moderate" | "busy"

function loadLevelFor(activeCount: number): LoadLevel {
  if (activeCount <= 2) return "light"
  if (activeCount <= 5) return "moderate"
  return "busy"
}

const LOAD_STYLES: Record<LoadLevel, { bar: string; text: string; labelKey: "loadLight" | "loadModerate" | "loadBusy" }> = {
  light: { bar: "bg-green-600", text: "text-green-600", labelKey: "loadLight" },
  moderate: { bar: "bg-amber-600", text: "text-amber-600", labelKey: "loadModerate" },
  busy: { bar: "bg-destructive", text: "text-destructive", labelKey: "loadBusy" },
}

export function KitchenStatsFooter({ orders, now }: { orders: KdsOrder[]; now: number }) {
  const locale = useLocale()
  const t = useTranslations("KitchenDisplay")

  const activeOrders = orders.filter((o) => o.status !== "ready")
  const activeCount = activeOrders.length
  const level = loadLevelFor(activeCount)
  const barWidth = Math.min(100, (activeCount / 8) * 100)

  const avgWaitMinutes =
    activeCount === 0
      ? 0
      : Math.round(
          activeOrders.reduce((sum, o) => sum + (now - o.createdAt), 0) / activeCount / 60000
        )

  const clock = new Date(now).toLocaleTimeString(locale === "vi" ? "vi-VN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: locale !== "vi",
  })

  return (
    <footer className="flex h-12 shrink-0 items-center gap-8 rounded-xl border bg-muted px-6">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-muted-foreground">{t("currentLoad")}:</span>
        <div className="h-2 w-32 overflow-hidden rounded-full bg-border">
          <div className={cn("h-full transition-all", LOAD_STYLES[level].bar)} style={{ width: `${barWidth}%` }} />
        </div>
        <span className={cn("text-xs font-bold", LOAD_STYLES[level].text)}>{t(LOAD_STYLES[level].labelKey)}</span>
      </div>
      <div className="h-4 w-px bg-border" />
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">
          {t("queueLabel")}: <strong className="text-card-foreground">{t("queueOrders", { count: activeCount })}</strong>
        </span>
        <span className="text-sm text-muted-foreground">
          {t("waitTimeLabel")}: <strong className="text-card-foreground">{t("waitTimeValue", { minutes: avgWaitMinutes })}</strong>
        </span>
      </div>
      <span className="ml-auto text-lg font-bold text-primary">{clock}</span>
    </footer>
  )
}
