import { getTranslations } from "next-intl/server"

export default async function OrderHistoryPage() {
  const t = await getTranslations("Customer")
  return <main className="p-8"><h1>{t("orderHistoryTitle")}</h1></main>
}
