import { CustomerHeader } from "@/components/customer/header"
import { BottomNav } from "@/components/customer/bottom-nav"

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CustomerHeader />
      <div className="min-h-screen pb-20">{children}</div>
      <BottomNav />
    </>
  )
}
