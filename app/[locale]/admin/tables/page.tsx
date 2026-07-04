import { getTranslations } from "next-intl/server"
import { TablesManagement } from "@/components/admin/tables-management"

export default async function TablesPage() {
  const t = await getTranslations("Admin")
  return (
    <>
      <h1 className="sr-only">{t("tablesTitle")}</h1>
      <TablesManagement />
    </>
  )
}
