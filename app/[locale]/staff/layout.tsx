import { KitchenOrdersProvider } from "@/hooks/useKitchenOrders"

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen overflow-hidden">
      <KitchenOrdersProvider>{children}</KitchenOrdersProvider>
    </div>
  )
}
