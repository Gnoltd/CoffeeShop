import { getTranslations } from "next-intl/server"

export default async function InventoryPage() {
  const t = await getTranslations("Admin")
  return <main className="p-8"><h1>{t("inventoryTitle")}</h1></main>
}
