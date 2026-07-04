import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { menuItems } from "@/lib/mock-data/menu"
import { ProductDetail } from "@/components/customer/product-detail"

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ itemId: string }>
}) {
  const { itemId } = await params
  const item = menuItems.find((i) => i.id === itemId)
  if (!item) notFound()

  const t = await getTranslations("Customer")
  return (
    <>
      <h1 className="sr-only">{t("menuTitle")}</h1>
      <ProductDetail item={item} />
    </>
  )
}
