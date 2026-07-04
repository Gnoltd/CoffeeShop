import { getTranslations } from "next-intl/server"

export default async function CheckoutPage() {
  const t = await getTranslations("Customer")
  return <main className="p-8"><h1>{t("checkoutTitle")}</h1></main>
}
