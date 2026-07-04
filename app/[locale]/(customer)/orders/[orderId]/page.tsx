import { getLocale, getTranslations } from "next-intl/server"
import { OrderTracking } from "@/components/customer/order-tracking"

export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  const t = await getTranslations("Customer")
  const locale = await getLocale()
  return (
    <>
      <h1 className="sr-only">{t("orderTrackingTitle")}</h1>
      <OrderTracking orderId={orderId} locale={locale} />
    </>
  )
}
