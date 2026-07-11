import { ROLE_HOME } from "@/lib/roles"

export const ADMIN_ONLY_PREFIXES = ["/admin/staff", "/admin/settings"]

export const AUTH_REQUIRED_EXACT_PATHS = ["/profile", "/profile/settings", "/profile/addresses", "/orders", "/loyalty"]

export const ROUTE_GROUP_ROLES: { prefix: string; roles: string[] }[] = [
  { prefix: "/staff", roles: ["staff", "manager", "admin"] },
  { prefix: "/admin", roles: ["manager", "admin"] },
]

export function resolveRedirect(pathname: string, role: string | null): string | null {
  if (AUTH_REQUIRED_EXACT_PATHS.includes(pathname) && !role) {
    return "/login"
  }

  const adminOnlyMatch = ADMIN_ONLY_PREFIXES.find((p) => pathname.startsWith(p))
  if (adminOnlyMatch) {
    if (role !== "admin") {
      return role ? (ROLE_HOME[role] ?? "/menu") : "/login"
    }
    return null
  }

  const match = ROUTE_GROUP_ROLES.find((r) => pathname.startsWith(r.prefix))
  if (!match) return null

  if (!role || !match.roles.includes(role)) {
    return role ? (ROLE_HOME[role] ?? "/menu") : "/login"
  }
  return null
}

/** Splits a locale-prefixed pathname (e.g. "/vi/staff/pos") into its locale and the rest ("/staff/pos"). */
export function splitLocaleFromPathname(pathname: string): { locale: string; rest: string } {
  const segments = pathname.split("/")
  const locale = segments[1]
  const rest = "/" + segments.slice(2).join("/")
  return { locale, rest: rest === "/" ? "/" : rest.replace(/\/+$/, "") || "/" }
}
