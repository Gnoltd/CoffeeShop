import { getTranslations } from "next-intl/server"
import { MyRedemptionsView } from "@/components/customer/my-redemptions-view"

export default async function MyRedemptionsPage() {
  const t = await getTranslations("MyRedemptions")
  return (
    <>
      <h1 className="sr-only">{t("title")}</h1>
      <MyRedemptionsView />
    </>
  )
}
