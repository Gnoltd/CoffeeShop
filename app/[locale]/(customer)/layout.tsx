import { CartProvider } from "@/hooks/useCart"
import { CustomerHeader } from "@/components/customer/header"
import { BottomNav } from "@/components/customer/bottom-nav"

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <CustomerHeader />
      <div className="min-h-screen pb-20">{children}</div>
      <BottomNav />
    </CartProvider>
  )
}
