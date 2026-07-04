import { getTranslations } from "next-intl/server"

export default async function StaffAccountsPage() {
  const t = await getTranslations("Admin")
  return <main className="p-8"><h1>{t("staffTitle")}</h1></main>
}
