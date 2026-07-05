import { getTranslations } from "next-intl/server"
import { MenuManagement } from "@/components/admin/menu-management"
import { createClient } from "@/lib/supabase/server"
import { getCategories, getMenuItems } from "@/lib/supabase/menu-data"

export default async function AdminMenuPage() {
  const t = await getTranslations("Admin")
  const supabase = await createClient()
  const [categories, items] = await Promise.all([getCategories(supabase), getMenuItems(supabase)])

  return (
    <>
      <h1 className="sr-only">{t("menuTitle")}</h1>
      <MenuManagement categories={categories} initialItems={items} />
    </>
  )
}
