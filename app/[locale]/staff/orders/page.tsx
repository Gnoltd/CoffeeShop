import { getTranslations } from "next-intl/server"
import { KitchenDisplay } from "@/components/staff/kitchen-display"

export default async function KitchenDisplayPage() {
  const t = await getTranslations("Staff")
  return (
    <div className="h-full">
      <h1 className="sr-only">{t("kitchenDisplayTitle")}</h1>
      <KitchenDisplay />
    </div>
  )
}
