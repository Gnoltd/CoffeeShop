import { LogIn, User, Briefcase } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { ROLE_HOME } from "@/lib/roles"

export async function RoleBadge({ role }: { role: string | null }) {
  const t = await getTranslations("RoleNav")

  const { label, href, Icon } =
    role === "staff"
      ? { label: t("badgeStaff"), href: ROLE_HOME.staff, Icon: Briefcase }
      : role === "manager" || role === "admin"
        ? { label: t("badgeAdmin"), href: ROLE_HOME[role], Icon: Briefcase }
        : role === "customer"
          ? { label: t("badgeCustomer"), href: "/profile", Icon: User }
          : { label: t("badgeGuest"), href: "/login", Icon: LogIn }

  return (
    <Link
      href={href}
      className="flex items-center gap-1 rounded-full border bg-card px-3 py-1 text-xs font-medium text-secondary shadow-sm transition-colors hover:bg-muted"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  )
}
