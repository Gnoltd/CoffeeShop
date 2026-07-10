"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Link, useRouter } from "@/i18n/navigation"
import { createClient } from "@/lib/supabase/client"
import { getCurrentRole } from "@/lib/get-current-role"
import { ROLE_HOME } from "@/lib/roles"

const TIMEOUT_MS = 6000

export function OAuthCallback() {
  const t = useTranslations("Auth")
  const router = useRouter()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let resolved = false

    async function resolveAndRedirect() {
      if (resolved) return
      resolved = true
      const role = await getCurrentRole(supabase)
      router.push(ROLE_HOME[role ?? "customer"] ?? "/menu")
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) resolveAndRedirect()
    })

    const timeout = setTimeout(() => {
      if (!resolved) setTimedOut(true)
    }, TIMEOUT_MS)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [router])

  if (timedOut) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-sm flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-destructive">{t("oauthCallbackError")}</p>
        <Link href="/login" className="font-bold text-primary hover:underline">
          {t("login")}
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <p className="text-sm text-muted-foreground">{t("oauthRedirecting")}</p>
    </div>
  )
}
