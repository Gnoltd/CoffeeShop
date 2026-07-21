"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Coffee, Bell, Settings, Wallet, LogIn, LogOut } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { cn } from "@/lib/utils"
import { useKitchenOrders } from "@/hooks/useKitchenOrders"
import { useShift } from "@/hooks/useShift"
import { ShiftControlsDialog } from "@/components/staff/shift-controls-dialog"

export function KitchenTopBar() {
  const tBrand = useTranslations("Brand")
  const t = useTranslations("KitchenDisplay")
  const { isRealtimeConnected } = useKitchenOrders()
  const { isShiftOpen, isCurrentUserWorking, joinShift, leaveShift } = useShift()
  const [dialogMode, setDialogMode] = useState<"open" | "close" | null>(null)
  const [isTogglingMembership, setIsTogglingMembership] = useState(false)

  async function handleToggleMembership() {
    setIsTogglingMembership(true)
    try {
      if (isCurrentUserWorking) {
        await leaveShift()
      } else {
        await joinShift()
      }
    } catch {
      // Realtime/refetch will reconcile the button state either way.
    } finally {
      setIsTogglingMembership(false)
    }
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b bg-card pl-4 pr-52 md:px-4">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-primary">
          <Coffee className="h-5 w-5" />
          {tBrand("name")}
        </Link>
        <div className="hidden h-6 w-px bg-border md:block" />
        <span className="hidden text-sm font-semibold text-muted-foreground md:inline">{t("stationLabel")}</span>
      </div>
      <div className="flex items-center gap-3 md:mr-52">
        <div className="nb-border-sm flex items-center gap-2 rounded-lg bg-chip px-2 py-1.5 md:px-3">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              isRealtimeConnected ? "animate-pulse bg-green-500" : "bg-destructive"
            )}
          />
          <span className="hidden text-xs text-muted-foreground md:inline">
            {isRealtimeConnected ? t("systemOnline") : t("systemOffline")}
          </span>
        </div>
        {isShiftOpen ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isTogglingMembership}
              onClick={handleToggleMembership}
              className="nb-border-sm flex items-center gap-1.5 rounded-lg bg-chip px-2 py-1.5 text-xs font-bold text-muted-foreground md:px-3"
            >
              {isCurrentUserWorking ? <LogOut className="h-3.5 w-3.5" /> : <LogIn className="h-3.5 w-3.5" />}
              <span className="hidden md:inline">{isCurrentUserWorking ? t("leaveShiftButton") : t("joinShiftButton")}</span>
            </button>
            <button
              type="button"
              onClick={() => setDialogMode("close")}
              className="nb-border-sm flex items-center gap-1.5 rounded-lg bg-primary px-2 py-1.5 text-xs font-bold text-primary-foreground md:px-3"
            >
              <Wallet className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{t("closeShiftButton")}</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setDialogMode("open")}
            className="nb-border-sm flex items-center gap-1.5 rounded-lg bg-primary px-2 py-1.5 text-xs font-bold text-primary-foreground md:px-3"
          >
            <Wallet className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{t("openShiftButton")}</span>
          </button>
        )}
        <div className="hidden items-center gap-3 md:flex">
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
      </div>
      {dialogMode && <ShiftControlsDialog mode={dialogMode} onClose={() => setDialogMode(null)} />}
    </header>
  )
}
