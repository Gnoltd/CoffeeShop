import { getTranslations } from "next-intl/server"

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("Brand")
  return (
    <div>
      <header className="p-4 border-b">{t("name")}</header>
      {children}
    </div>
  )
}
