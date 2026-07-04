import { setRequestLocale } from "next-intl/server"
import { FoodCostCalculator } from "@/components/admin/food-cost-calculator"

export default async function FoodCostPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return <FoodCostCalculator />
}
