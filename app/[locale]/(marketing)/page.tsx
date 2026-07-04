import { getTranslations } from "next-intl/server"

export default async function LandingPage() {
  const t = await getTranslations("Landing")
  return <main className="p-8"><h1>{t("title")}</h1></main>
}
