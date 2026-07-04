import { getTranslations } from "next-intl/server"
import { LoyaltyView } from "@/components/customer/loyalty-view"

export default async function LoyaltyPage() {
  const t = await getTranslations("Customer")
  return (
    <>
      <h1 className="sr-only">{t("loyaltyTitle")}</h1>
      <LoyaltyView />
    </>
  )
}
