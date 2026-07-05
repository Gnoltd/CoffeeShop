import { getTranslations } from "next-intl/server"
import { StaffNav } from "@/components/staff/staff-nav"
import { PosTerminal } from "@/components/staff/pos-terminal"

export default async function PosPage() {
  const t = await getTranslations("Staff")
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <h1 className="sr-only">{t("posTitle")}</h1>
      <StaffNav />
      <div className="flex-1 overflow-hidden">
        <PosTerminal />
      </div>
    </div>
  )
}
