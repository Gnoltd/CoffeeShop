import { getTranslations } from "next-intl/server"

export default async function MenuPage() {
  const t = await getTranslations("Customer")
  return <main className="p-8"><h1>{t("menuTitle")}</h1></main>
}
