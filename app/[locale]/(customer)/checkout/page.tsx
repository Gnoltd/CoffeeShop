import { getTranslations } from "next-intl/server"
import { CheckoutView } from "@/components/customer/checkout-view"

export default async function CheckoutPage() {
  const t = await getTranslations("Customer")
  return (
    <>
      <h1 className="sr-only">{t("checkoutTitle")}</h1>
      <CheckoutView />
    </>
  )
}
