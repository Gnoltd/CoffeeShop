"use client"

import { useEffect, useState } from "react"
import { KitchenTopBar } from "@/components/staff/kitchen-top-bar"
import { KitchenSidebar } from "@/components/staff/kitchen-sidebar"
import { KitchenStatsFooter } from "@/components/staff/kitchen-stats-footer"
import { KitchenBoard, INITIAL_ORDERS, NEXT_STATUS, type KdsOrder } from "@/components/staff/kitchen-board"

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

export function KitchenDisplay() {
  const [orders, setOrders] = useState<KdsOrder[]>(INITIAL_ORDERS)
  const [now, setNow] = useState(() => Date.now())
  const [completedCount, setCompletedCount] = useState(0)
  const [completedDurations, setCompletedDurations] = useState<number[]>([])

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  function advance(orderId: string) {
    const order = orders.find((o) => o.id === orderId)
    if (!order) return
    const next = NEXT_STATUS[order.status]

    if (!next) {
      const duration = Date.now() - order.createdAt
      setCompletedCount((count) => count + 1)
      setCompletedDurations((durations) => [...durations, duration])
      setOrders((prev) => prev.filter((o) => o.id !== orderId))
      return
    }

    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: next } : o)))
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
          <div className="flex-1 overflow-hidden">
            <KitchenBoard orders={orders} now={now} onAdvance={advance} />
          </div>
          <KitchenStatsFooter orders={orders} now={now} />
        </div>
      </div>
    </div>
  )
}
