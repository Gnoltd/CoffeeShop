"use client"

import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { Link, usePathname } from "@/i18n/navigation"
import { KitchenTopBar } from "@/components/staff/kitchen-top-bar"
import { KitchenSidebar } from "@/components/staff/kitchen-sidebar"
import { useKitchenOrders } from "@/hooks/useKitchenOrders"

export default function StaffOrdersLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("KitchenDisplay")
  const pathname = usePathname()
  const isHistoryActive = pathname === "/staff/orders/history"
  const { completedCount, avgTimeLabel } = useKitchenOrders()

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <KitchenTopBar />
      <div className="flex items-center justify-between gap-2 overflow-x-auto border-b bg-muted/40 px-3 py-2 md:hidden">
        <nav className="flex shrink-0 gap-1">
          <Link
            href="/staff/orders"
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-bold",
              !isHistoryActive ? "bg-secondary/20 text-secondary" : "text-muted-foreground"
            )}
          >
            {t("liveOrders")}
          </Link>
          <Link
            href="/staff/orders/history"
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-bold",
              isHistoryActive ? "bg-secondary/20 text-secondary" : "text-muted-foreground"
            )}
          >
            {t("orderHistoryNav")}
          </Link>
        </nav>
        <div className="flex shrink-0 gap-3 text-[11px] text-muted-foreground">
          <span>
            {t("completedLabel")}: <strong className="text-card-foreground">{completedCount}</strong>
          </span>
          <span>
            {t("avgTimeLabel")}: <strong className="text-card-foreground">{avgTimeLabel}</strong>
          </span>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <KitchenSidebar completedCount={completedCount} avgTimeLabel={avgTimeLabel} />
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  )
}
