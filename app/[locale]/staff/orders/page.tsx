import { getTranslations } from "next-intl/server"
import { KitchenDisplay } from "@/components/staff/kitchen-display"

export default async function KitchenDisplayPage() {
  const t = await getTranslations("Staff")
  return (
    <>
      <h1 className="sr-only">{t("kitchenDisplayTitle")}</h1>
      <KitchenDisplay />
    </>
  )
}
