import { CustomerHeader } from "@/components/customer/header"
import { BottomNav } from "@/components/customer/bottom-nav"
import { createClient } from "@/lib/supabase/server"
import { getCurrentRole } from "@/lib/get-current-role"

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const role = await getCurrentRole(supabase)
  return (
    <>
      <CustomerHeader role={role} />
      <div className="min-h-screen pb-20">{children}</div>
      <BottomNav />
    </>
  )
}
