import { getTranslations } from "next-intl/server"

export default async function LoyaltyPage() {
  const t = await getTranslations("Customer")
  return <main className="p-8"><h1>{t("loyaltyTitle")}</h1></main>
}
