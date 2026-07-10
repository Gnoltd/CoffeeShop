import { getTranslations } from "next-intl/server"
import { ProfileSettingsView } from "@/components/customer/profile-settings-view"

export default async function ProfileSettingsPage() {
  const t = await getTranslations("Customer")
  return (
    <>
      <h1 className="sr-only">{t("settingsTitle")}</h1>
      <ProfileSettingsView />
    </>
  )
}
