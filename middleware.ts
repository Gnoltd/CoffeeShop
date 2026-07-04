import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

export const ROLE_HOME: Record<string, string> = {
  customer: "/menu",
  staff: "/staff/pos",
  manager: "/admin/dashboard",
  admin: "/admin/dashboard",
}

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

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  let role: string | null = null

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseAnonKey) {
    try {
      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            response = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
          },
        },
      })

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
        role = profile?.role ?? null
      }
    } catch {
      // Supabase unreachable or misconfigured — fall through and treat the request as anonymous
      // rather than taking the whole site down.
      role = null
    }
  }

  const redirectPath = resolveRedirect(request.nextUrl.pathname, role)
  if (redirectPath) {
    return NextResponse.redirect(new URL(redirectPath, request.url))
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
