import { getTranslations } from "next-intl/server"
import { MenuBrowser } from "@/components/customer/menu-browser"
import { createClient } from "@/lib/supabase/server"
import { getCategories, getMenuItems } from "@/lib/supabase/menu-data"

export default async function MenuPage() {
  const t = await getTranslations("Customer")
  const supabase = await createClient()
  const [categories, items] = await Promise.all([getCategories(supabase), getMenuItems(supabase)])

  return (
    <>
      <h1 className="sr-only">{t("menuTitle")}</h1>
      <MenuBrowser categories={categories} items={items} />
    </>
  )
}
