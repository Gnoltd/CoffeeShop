import { getTranslations } from "next-intl/server"
import { LandingView } from "@/components/marketing/landing-view"
import { createClient } from "@/lib/supabase/server"
import { getMenuItems } from "@/lib/supabase/menu-data"

export default async function LandingPage() {
  const t = await getTranslations("Landing")
  const supabase = await createClient()
  const items = await getMenuItems(supabase)
  const bestSellers = items.filter((item) => item.isPopular)

  return (
    <>
      <h1 className="sr-only">{t("title")}</h1>
      <LandingView bestSellers={bestSellers} />
    </>
  )
}
