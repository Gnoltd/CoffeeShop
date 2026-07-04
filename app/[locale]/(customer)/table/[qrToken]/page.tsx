import { getTranslations } from "next-intl/server"

export default async function TableOrderPage({
  params,
}: {
  params: Promise<{ qrToken: string }>
}) {
  const { qrToken } = await params
  const t = await getTranslations("Customer")
  return (
    <main className="p-8">
      <h1>{t("tableOrderTitle")}</h1>
      <p>{t("tableTokenLabel")}: {qrToken}</p>
    </main>
  )
}
