import { getTranslations } from "next-intl/server"

export default async function CartPage() {
  const t = await getTranslations("Customer")
  return <main className="p-8"><h1>{t("cartTitle")}</h1></main>
}
