"use client"

import { useEffect, useState } from "react"
import { KitchenStatsFooter } from "@/components/staff/kitchen-stats-footer"
import { KitchenBoard } from "@/components/staff/kitchen-board"
import { KitchenPendingPayment } from "@/components/staff/kitchen-pending-payment"
import { useKitchenOrders } from "@/hooks/useKitchenOrders"

export function KitchenDisplay() {
  const { orders, pendingPaymentOrders, advance, confirmCashPayment } = useKitchenOrders()
  const [now, setNow] = useState(0)

  useEffect(() => {
    setNow(Date.now())
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden p-3">
      {pendingPaymentOrders.length > 0 && (
        <KitchenPendingPayment orders={pendingPaymentOrders} onConfirm={confirmCashPayment} />
      )}
      <div className="flex-1 overflow-hidden">
        <KitchenBoard orders={orders} now={now} onAdvance={advance} />
      </div>
      <KitchenStatsFooter orders={orders} now={now} />
    </div>
  )
}
