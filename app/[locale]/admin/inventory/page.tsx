import { getLocale, getTranslations } from "next-intl/server"
import { InventoryManagement } from "@/components/admin/inventory-management"

export default async function InventoryPage() {
  const t = await getTranslations("Admin")
  const locale = await getLocale()
  return (
    <>
      <h1 className="sr-only">{t("inventoryTitle")}</h1>
      <InventoryManagement locale={locale} />
    </>
  )
}
