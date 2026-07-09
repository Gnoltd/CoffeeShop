import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import createIntlMiddleware from "next-intl/middleware"
import { routing } from "./i18n/routing"
import { resolveRedirect, splitLocaleFromPathname } from "./lib/middleware-rules"

const handleI18nRouting = createIntlMiddleware(routing)

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

    const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).single()
    if (!profile) return null
    return profile.is_active ? profile.role : "customer"
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
  matcher: [
    "/((?!api|_next|_vercel|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)",
  ],
}
