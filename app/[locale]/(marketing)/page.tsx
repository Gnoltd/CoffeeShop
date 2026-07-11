import { getTranslations } from "next-intl/server"
import { LandingView } from "@/components/marketing/landing-view"
import { getPublicMenuData } from "@/lib/supabase/menu-data-cached"

export default async function LandingPage() {
  const t = await getTranslations("Landing")
  const { items } = await getPublicMenuData()
  const bestSellers = items.filter((item) => item.isPopular)

  return (
    <>
      <h1 className="sr-only">{t("title")}</h1>
      <LandingView bestSellers={bestSellers} />
    </>
  )
}
