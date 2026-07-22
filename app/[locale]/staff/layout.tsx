import { KitchenOrdersProvider } from "@/hooks/useKitchenOrders"
import { ShiftProvider } from "@/hooks/useShift"

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-dvh overflow-hidden">
      <ShiftProvider>
        <KitchenOrdersProvider>{children}</KitchenOrdersProvider>
      </ShiftProvider>
    </div>
  )
}
