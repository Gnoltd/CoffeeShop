import { getTranslations } from "next-intl/server"
import { PosTerminal } from "@/components/staff/pos-terminal"

export default async function PosPage() {
  const t = await getTranslations("Staff")
  return (
    <>
      <h1 className="sr-only">{t("posTitle")}</h1>
      <PosTerminal />
    </>
  )
}
