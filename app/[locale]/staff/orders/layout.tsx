"use client"

import { KitchenTopBar } from "@/components/staff/kitchen-top-bar"
import { KitchenSidebar } from "@/components/staff/kitchen-sidebar"
import { useKitchenOrders } from "@/hooks/useKitchenOrders"

export default function StaffOrdersLayout({ children }: { children: React.ReactNode }) {
  const { completedCount, avgTimeLabel } = useKitchenOrders()

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <KitchenTopBar />
      <div className="flex flex-1 overflow-hidden">
        <KitchenSidebar completedCount={completedCount} avgTimeLabel={avgTimeLabel} />
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  )
}
