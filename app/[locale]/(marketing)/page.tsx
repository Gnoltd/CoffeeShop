import { getTranslations } from "next-intl/server"
import { LandingView } from "@/components/marketing/landing-view"

export default async function LandingPage() {
  const t = await getTranslations("Landing")
  return (
    <>
      <h1 className="sr-only">{t("title")}</h1>
      <LandingView />
    </>
  )
}
