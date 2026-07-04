import { getTranslations } from "next-intl/server"

export default async function PosPage() {
  const t = await getTranslations("Staff")
  return <main className="p-8"><h1>{t("posTitle")}</h1></main>
}
