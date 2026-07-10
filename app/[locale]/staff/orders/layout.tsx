import { createClient } from "@/lib/supabase/server"
import { getCurrentRole } from "@/lib/get-current-role"
import { StaffOrdersLayoutClient } from "@/components/staff/staff-orders-layout-client"

export default async function StaffOrdersLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const role = await getCurrentRole(supabase)

  return <StaffOrdersLayoutClient role={role}>{children}</StaffOrdersLayoutClient>
}
