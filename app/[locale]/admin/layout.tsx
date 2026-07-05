import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { InventoryProvider } from "@/hooks/useInventory"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <InventoryProvider>
      <div className="flex h-screen overflow-hidden">
        <AdminSidebar />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-6">{children}</main>
      </div>
    </InventoryProvider>
  )
}
