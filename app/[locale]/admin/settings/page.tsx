import { getTranslations } from "next-intl/server"

export default async function SettingsPage() {
  const t = await getTranslations("Admin")
  return <main className="p-8"><h1>{t("settingsTitle")}</h1></main>
}
