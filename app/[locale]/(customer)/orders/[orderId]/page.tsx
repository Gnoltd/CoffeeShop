import { getTranslations } from "next-intl/server"

export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  const t = await getTranslations("Customer")
  return (
    <main className="p-8">
      <h1>{t("orderTrackingTitle")}</h1>
      <p>{t("orderIdLabel")}: {orderId}</p>
    </main>
  )
}
