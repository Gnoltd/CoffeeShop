import { getTranslations } from "next-intl/server"
import { MenuManagement } from "@/components/admin/menu-management"

export default async function AdminMenuPage() {
  const t = await getTranslations("Admin")
  return (
    <>
      <h1 className="sr-only">{t("menuTitle")}</h1>
      <MenuManagement />
    </>
  )
}
