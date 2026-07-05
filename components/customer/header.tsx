import { Coffee, Briefcase } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { BackButton } from "@/components/customer/back-button"
import { Link } from "@/i18n/navigation"
import { ROLE_HOME } from "@/lib/roles"

export async function CustomerHeader({
  showBack = false,
  role = null,
}: {
  showBack?: boolean
  role?: string | null
}) {
  const t = await getTranslations("Brand")
  const tCustomer = await getTranslations("Customer")
  const tRoleNav = await getTranslations("RoleNav")
  const isStaffRole = role === "staff" || role === "manager" || role === "admin"

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-card/95 px-4 backdrop-blur-sm">
      {showBack && <BackButton label={tCustomer("back")} />}
      <Link href="/" className="flex items-center gap-2">
        <Coffee className="h-5 w-5 text-primary" />
        <span className="font-semibold text-primary">{t("name")}</span>
      </Link>
      {role && isStaffRole && (
        <Link
          href={ROLE_HOME[role]}
          className="ml-auto flex items-center gap-1 rounded-full bg-secondary/15 px-3 py-1 text-xs font-medium text-secondary transition-colors hover:bg-secondary/25"
        >
          <Briefcase className="h-3.5 w-3.5" />
          {role === "staff" ? tRoleNav("badgeStaff") : tRoleNav("badgeAdmin")}
        </Link>
      )}
    </header>
  )
}
