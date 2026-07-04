import { getTranslations } from "next-intl/server"

export default async function LoginPage() {
  const t = await getTranslations("Auth")
  return <main><h1>{t("login")}</h1></main>
}
