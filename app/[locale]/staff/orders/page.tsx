import { getTranslations } from "next-intl/server"

export default async function KitchenDisplayPage() {
  const t = await getTranslations("Staff")
  return <main className="p-8"><h1>{t("kitchenDisplayTitle")}</h1></main>
}
