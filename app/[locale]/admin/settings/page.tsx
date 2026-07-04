import { getTranslations } from "next-intl/server"
import { SettingsView } from "@/components/admin/settings-view"

export default async function SettingsPage() {
  const t = await getTranslations("Admin")
  return (
    <>
      <h1 className="sr-only">{t("settingsTitle")}</h1>
      <SettingsView />
    </>
  )
}
