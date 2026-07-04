import { getTranslations } from "next-intl/server"
import { MenuBrowser } from "@/components/customer/menu-browser"

export default async function MenuPage() {
  const t = await getTranslations("Customer")
  return (
    <>
      <h1 className="sr-only">{t("menuTitle")}</h1>
      <MenuBrowser />
    </>
  )
}
