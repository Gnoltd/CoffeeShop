"use client"

import { useEffect, useState } from "react"
import { KitchenTopBar } from "@/components/staff/kitchen-top-bar"
import { KitchenSidebar } from "@/components/staff/kitchen-sidebar"
import { KitchenStatsFooter } from "@/components/staff/kitchen-stats-footer"
import { KitchenBoard } from "@/components/staff/kitchen-board"
import { KitchenPendingPayment } from "@/components/staff/kitchen-pending-payment"
import { useKitchenOrders } from "@/hooks/useKitchenOrders"

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

export function KitchenDisplay() {
  const { orders, pendingPaymentOrders, advance: advanceShared, confirmCashPayment } = useKitchenOrders()
  const [now, setNow] = useState(() => Date.now())
  const [completedCount, setCompletedCount] = useState(0)
  const [completedDurations, setCompletedDurations] = useState<number[]>([])

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  async function advance(orderId: string) {
    const order = orders.find((o) => o.id === orderId)
    if (order && order.status === "ready") {
      const duration = Date.now() - order.createdAt
      setCompletedCount((count) => count + 1)
      setCompletedDurations((durations) => [...durations, duration])
    }
    await advanceShared(orderId)
  }

  const avgTimeLabel =
    completedDurations.length === 0
      ? "--:--"
      : formatDuration(completedDurations.reduce((sum, d) => sum + d, 0) / completedDurations.length)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <KitchenTopBar />
      <div className="flex flex-1 overflow-hidden">
        <KitchenSidebar completedCount={completedCount} avgTimeLabel={avgTimeLabel} />
        <div className="flex flex-1 flex-col gap-3 overflow-hidden p-3">
          {pendingPaymentOrders.length > 0 && (
            <KitchenPendingPayment orders={pendingPaymentOrders} onConfirm={confirmCashPayment} />
          )}
          <div className="flex-1 overflow-hidden">
            <KitchenBoard orders={orders} now={now} onAdvance={advance} />
          </div>
          <KitchenStatsFooter orders={orders} now={now} />
        </div>
      </div>
    </div>
  )
}
