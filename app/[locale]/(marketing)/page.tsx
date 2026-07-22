import { getTranslations } from "next-intl/server"
import { LandingView } from "@/components/marketing/landing-view"
import { getPublicMenuData } from "@/lib/supabase/menu-data-cached"
import { getLandingHeroSettings } from "@/lib/supabase/settings-data"
import { getProfile } from "@/lib/supabase/profile-data"
import { createClient } from "@/lib/supabase/server"

async function getCurrentUserName(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  try {
    const { fullName } = await getProfile(supabase, user.id)
    return fullName || user.email?.split("@")[0] || null
  } catch {
    return user.email?.split("@")[0] ?? null
  }
}

export default async function LandingPage() {
  const t = await getTranslations("Landing")
  const supabase = await createClient()
  const [{ items }, landingHero, userName] = await Promise.all([
    getPublicMenuData(),
    getLandingHeroSettings(supabase),
    getCurrentUserName(supabase),
  ])
  const bestSellers = items.filter((item) => item.isPopular)

  return (
    <>
      <h1 className="sr-only">{t("title")}</h1>
      <LandingView bestSellers={bestSellers} landingHero={landingHero} userName={userName} />
    </>
  )
}
