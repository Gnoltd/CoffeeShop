import { getTranslations } from "next-intl/server"

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("Nav")
  return (
    <div>
      <nav className="p-4 border-b flex gap-4">
        <span>{t("pos")}</span>
        <span>{t("kitchenDisplay")}</span>
      </nav>
      {children}
    </div>
  )
}
