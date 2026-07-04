import { getTranslations } from "next-intl/server"

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("Nav")
  return (
    <div>
      <nav className="p-4 border-b flex gap-4">
        <span>{t("menu")}</span>
        <span>{t("cart")}</span>
        <span>{t("orders")}</span>
        <span>{t("profile")}</span>
        <span>{t("loyalty")}</span>
      </nav>
      {children}
    </div>
  )
}
