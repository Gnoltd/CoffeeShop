import { getTranslations } from "next-intl/server"
import { TableLanding } from "@/components/customer/table-landing"

export default async function TableOrderPage({
  params,
}: {
  params: Promise<{ qrToken: string }>
}) {
  const { qrToken } = await params
  const t = await getTranslations("Customer")
  return (
    <>
      <h1 className="sr-only">{t("tableOrderTitle")}</h1>
      <TableLanding qrToken={qrToken} />
    </>
  )
}
