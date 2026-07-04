import { getTranslations } from "next-intl/server"

export default async function AdminMenuPage() {
  const t = await getTranslations("Admin")
  return <main className="p-8"><h1>{t("menuTitle")}</h1></main>
}
