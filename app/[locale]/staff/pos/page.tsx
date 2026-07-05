import { getTranslations } from "next-intl/server"
import { StaffNav } from "@/components/staff/staff-nav"
import { PosTerminal } from "@/components/staff/pos-terminal"
import { createClient } from "@/lib/supabase/server"
import { getCategories, getMenuItems } from "@/lib/supabase/menu-data"

export default async function PosPage() {
  const t = await getTranslations("Staff")
  const supabase = await createClient()
  const [categories, items] = await Promise.all([getCategories(supabase), getMenuItems(supabase)])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <h1 className="sr-only">{t("posTitle")}</h1>
      <StaffNav />
      <div className="flex-1 overflow-hidden">
        <PosTerminal categories={categories} items={items} />
      </div>
    </div>
  )
}
