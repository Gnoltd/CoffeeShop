import { getTranslations } from "next-intl/server"

export default async function TablesPage() {
  const t = await getTranslations("Admin")
  return <main className="p-8"><h1>{t("tablesTitle")}</h1></main>
}
