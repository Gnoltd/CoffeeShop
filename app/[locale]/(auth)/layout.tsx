import { CustomerHeader } from "@/components/customer/header"
import { createClient } from "@/lib/supabase/server"
import { getCurrentRole } from "@/lib/get-current-role"

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const role = await getCurrentRole(supabase)
  return (
    <>
      <CustomerHeader role={role} />
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center py-8">{children}</div>
    </>
  )
}
