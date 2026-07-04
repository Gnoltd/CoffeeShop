import { getTranslations } from "next-intl/server"

export default async function SignupPage() {
  const t = await getTranslations("Auth")
  return <main><h1>{t("signup")}</h1></main>
}
