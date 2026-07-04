import { getTranslations } from "next-intl/server"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("Nav")
  return (
    <div>
      <nav className="p-4 border-b flex gap-4">
        <span>{t("dashboard")}</span>
        <span>{t("menu")}</span>
        <span>{t("inventory")}</span>
        <span>{t("tables")}</span>
        <span>{t("staff")}</span>
        <span>{t("foodCost")}</span>
        <span>{t("settings")}</span>
      </nav>
      {children}
    </div>
  )
}
