import { getTranslations } from "next-intl/server"
import { LandingView } from "@/components/marketing/landing-view"
import { getPublicMenuData } from "@/lib/supabase/menu-data-cached"
import { getLandingHeroSettings } from "@/lib/supabase/settings-data"
import { createClient } from "@/lib/supabase/server"

export default async function LandingPage() {
  const t = await getTranslations("Landing")
  const supabase = await createClient()
  const [{ items }, landingHero] = await Promise.all([getPublicMenuData(), getLandingHeroSettings(supabase)])
  const bestSellers = items.filter((item) => item.isPopular)

  return (
    <>
      <h1 className="sr-only">{t("title")}</h1>
      <LandingView bestSellers={bestSellers} landingHero={landingHero} />
    </>
  )
}
