import { getTranslations } from "next-intl/server"
import { StaffAccounts } from "@/components/admin/staff-accounts"

export default async function StaffAccountsPage() {
  const t = await getTranslations("Admin")
  return (
    <>
      <h1 className="sr-only">{t("staffTitle")}</h1>
      <StaffAccounts />
    </>
  )
}
