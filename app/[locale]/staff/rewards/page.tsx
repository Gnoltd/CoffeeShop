import { getTranslations } from "next-intl/server"
import { StaffNav } from "@/components/staff/staff-nav"
import { RewardLookup } from "@/components/staff/reward-lookup"
import { createClient } from "@/lib/supabase/server"
import { getCurrentRole } from "@/lib/get-current-role"

export default async function StaffRewardsPage() {
  const t = await getTranslations("StaffRewards")
  const supabase = await createClient()
  const role = await getCurrentRole(supabase)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <h1 className="sr-only">{t("title")}</h1>
      <StaffNav role={role} />
      <div className="flex-1 overflow-y-auto p-4">
        <RewardLookup />
      </div>
    </div>
  )
}
