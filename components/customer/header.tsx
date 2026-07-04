import { Coffee } from "lucide-react"
import { getTranslations } from "next-intl/server"

export async function CustomerHeader() {
  const t = await getTranslations("Brand")
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-card/95 px-4 backdrop-blur-sm">
      <Coffee className="h-5 w-5 text-primary" />
      <span className="font-semibold text-primary">{t("name")}</span>
    </header>
  )
}
