import { getLocale, getTranslations } from "next-intl/server"
import { OrderTracking } from "@/components/customer/order-tracking"

export default async function OrderTrackingPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>
  searchParams: Promise<{ table?: string }>
}) {
  const { orderId } = await params
  const { table } = await searchParams
  const t = await getTranslations("Customer")
  const locale = await getLocale()
  return (
    <>
      <h1 className="sr-only">{t("orderTrackingTitle")}</h1>
      <OrderTracking orderId={orderId} locale={locale} table={table} />
    </>
  )
}
