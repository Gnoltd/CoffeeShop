import { getTranslations } from "next-intl/server"
import { CartView } from "@/components/customer/cart-view"

export default async function CartPage() {
  const t = await getTranslations("Customer")
  return (
    <>
      <h1 className="sr-only">{t("cartTitle")}</h1>
      <CartView />
    </>
  )
}
