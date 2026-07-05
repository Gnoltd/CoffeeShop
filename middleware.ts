import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import createIntlMiddleware from "next-intl/middleware"
import { routing } from "./i18n/routing"
import { ROLE_HOME } from "./lib/roles"

const handleI18nRouting = createIntlMiddleware(routing)

const ADMIN_ONLY_PREFIXES = ["/admin/staff", "/admin/settings"]

const ROUTE_GROUP_ROLES: { prefix: string; roles: string[] }[] = [
  { prefix: "/staff", roles: ["staff", "manager", "admin"] },
  { prefix: "/admin", roles: ["manager", "admin"] },
]

export function resolveRedirect(pathname: string, role: string | null): string | null {
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

async function resolveRole(request: NextRequest): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabasePublishableKey) return null

  try {
    const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {
          // Cookie writes are handled by the outer response from next-intl's middleware;
          // this read-only client is only used here to resolve the current user's role.
        },
      },
    })

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return null

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    return profile?.role ?? null
  } catch {
    // Supabase unreachable or misconfigured — fall through and treat the request as anonymous
    // rather than taking the whole site down.
    return null
  }
}

export async function middleware(request: NextRequest) {
  // Let next-intl resolve/normalize the locale prefix first (e.g. "/" -> "/vi").
  const intlResponse = handleI18nRouting(request)

  // If next-intl already decided to redirect (locale prefix was missing/wrong),
  // let that happen first — our auth check will run again on the follow-up request.
  if (intlResponse.status === 307 || intlResponse.status === 308) {
    return intlResponse
  }

  const { locale, rest } = splitLocaleFromPathname(request.nextUrl.pathname)
  const role = await resolveRole(request)

  const redirectPath = resolveRedirect(rest, role)
  if (redirectPath) {
    return NextResponse.redirect(new URL(`/${locale}${redirectPath}`, request.url))
  }

  return intlResponse
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
