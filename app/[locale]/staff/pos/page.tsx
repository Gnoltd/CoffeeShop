import { getTranslations } from "next-intl/server"
import { StaffNav } from "@/components/staff/staff-nav"
import { PosTerminal } from "@/components/staff/pos-terminal"
import { createClient } from "@/lib/supabase/server"
import { getCategories, getMenuItems } from "@/lib/supabase/menu-data"
import { getCurrentRole } from "@/lib/get-current-role"

export default async function PosPage() {
  const t = await getTranslations("Staff")
  const supabase = await createClient()
  const [categories, items, role] = await Promise.all([
    getCategories(supabase),
    getMenuItems(supabase),
    getCurrentRole(supabase),
  ])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <h1 className="sr-only">{t("posTitle")}</h1>
      <StaffNav role={role} />
      <div className="flex-1 overflow-hidden">
        <PosTerminal categories={categories} items={items} />
      </div>
    </div>
  )
}
