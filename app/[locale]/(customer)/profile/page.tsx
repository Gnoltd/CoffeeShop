import { getTranslations } from "next-intl/server"
import { ProfileView } from "@/components/customer/profile-view"

export default async function ProfilePage() {
  const t = await getTranslations("Customer")
  return (
    <>
      <h1 className="sr-only">{t("profileTitle")}</h1>
      <ProfileView />
    </>
  )
}
