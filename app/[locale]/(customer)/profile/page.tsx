import { getTranslations } from "next-intl/server"
import { ProfileView } from "@/components/customer/profile-view"
import { createClient } from "@/lib/supabase/server"
import { getCurrentRole } from "@/lib/get-current-role"

export default async function ProfilePage() {
  const t = await getTranslations("Customer")
  const supabase = await createClient()
  const role = await getCurrentRole(supabase)
  return (
    <>
      <h1 className="sr-only">{t("profileTitle")}</h1>
      <ProfileView role={role} />
    </>
  )
}
