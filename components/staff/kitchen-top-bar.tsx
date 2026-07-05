"use client"

import { useTranslations } from "next-intl"
import { Coffee, Bell, Settings } from "lucide-react"
import { Link } from "@/i18n/navigation"

export function KitchenTopBar() {
  const tBrand = useTranslations("Brand")
  const t = useTranslations("KitchenDisplay")

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-primary">
          <Coffee className="h-5 w-5" />
          {tBrand("name")}
        </Link>
        <div className="h-6 w-px bg-border" />
        <span className="text-sm font-semibold text-muted-foreground">{t("stationLabel")}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border bg-muted px-3 py-1.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
          <span className="text-xs text-muted-foreground">{t("systemOnline")}</span>
        </div>
        <button
          type="button"
          disabled
          title="Not implemented yet — no notification system"
          className="rounded-full p-2 text-muted-foreground opacity-50"
        >
          <Bell className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled
          title="Not implemented yet — no staff settings page"
          className="rounded-full p-2 text-muted-foreground opacity-50"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
