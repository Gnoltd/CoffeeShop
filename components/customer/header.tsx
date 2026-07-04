import { Coffee } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { BackButton } from "@/components/customer/back-button"

export async function CustomerHeader({ showBack = false }: { showBack?: boolean }) {
  const t = await getTranslations("Brand")
  const tCustomer = await getTranslations("Customer")
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-card/95 px-4 backdrop-blur-sm">
      {showBack && <BackButton label={tCustomer("back")} />}
      <Coffee className="h-5 w-5 text-primary" />
      <span className="font-semibold text-primary">{t("name")}</span>
    </header>
  )
}
