import { getTranslations } from "next-intl/server"

export default async function ProfilePage() {
  const t = await getTranslations("Customer")
  return <main className="p-8"><h1>{t("profileTitle")}</h1></main>
}
