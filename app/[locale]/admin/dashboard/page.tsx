import { getLocale, getTranslations } from "next-intl/server"
import { DashboardView } from "@/components/admin/dashboard-view"

export default async function DashboardPage() {
  const t = await getTranslations("Admin")
  const locale = await getLocale()
  return (
    <>
      <h1 className="sr-only">{t("dashboardTitle")}</h1>
      <DashboardView locale={locale} />
    </>
  )
}
