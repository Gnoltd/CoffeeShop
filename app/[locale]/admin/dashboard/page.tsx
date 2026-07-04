import { getTranslations } from "next-intl/server"

export default async function DashboardPage() {
  const t = await getTranslations("Admin")
  return <main className="p-8"><h1>{t("dashboardTitle")}</h1></main>
}
