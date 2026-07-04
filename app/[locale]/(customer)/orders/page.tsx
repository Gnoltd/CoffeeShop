import { getTranslations } from "next-intl/server"
import { OrderHistory } from "@/components/customer/order-history"

export default async function OrderHistoryPage() {
  const t = await getTranslations("Customer")
  return (
    <>
      <h1 className="sr-only">{t("orderHistoryTitle")}</h1>
      <OrderHistory />
    </>
  )
}
