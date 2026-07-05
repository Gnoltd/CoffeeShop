"use client"

import { useState, type FormEvent } from "react"
import { useTranslations } from "next-intl"
import { Coffee, Mail, Eye, EyeOff } from "lucide-react"
import { Link, useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GoogleIcon } from "@/components/auth/google-icon"
import { createClient } from "@/lib/supabase/client"
import { ROLE_HOME } from "@/lib/roles"

export function LoginForm() {
  const t = useTranslations("Auth")
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setLoading(false)
      setError(signInError.message)
      return
    }

    let role: string | null = null
    if (data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single()
      role = profile?.role ?? null
    }

    router.push(ROLE_HOME[role ?? "customer"] ?? "/menu")
    router.refresh()
  }

  return (
    <div className="mx-auto w-full max-w-sm px-4">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
          <Coffee className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-card-foreground">{t("login")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("welcomeBack")}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="login-email" className="block px-1 text-xs font-medium text-muted-foreground">
            {t("emailLabel")}
          </label>
          <div className="relative">
            <Input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("emailPlaceholder")}
              className="h-12 rounded-xl pr-10"
            />
            <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="login-password" className="block px-1 text-xs font-medium text-muted-foreground">
            {t("passwordLabel")}
          </label>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("passwordPlaceholder")}
              className="h-12 rounded-xl pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? t("hidePassword") : t("showPassword")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="flex justify-end">
            <span
              className="cursor-not-allowed text-xs text-muted-foreground opacity-60"
              title="Not implemented yet — no password-reset flow wired up"
            >
              {t("forgotPassword")}
            </span>
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {t("loginError")}: {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="h-12 w-full rounded-xl text-base font-bold"
        >
          {loading ? t("loggingIn") : t("login")}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs italic text-muted-foreground">{t("or")}</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Button
        variant="outline"
        disabled
        title="Not implemented yet — Google OAuth not wired up"
        className="h-12 w-full gap-3 rounded-xl text-sm font-medium"
      >
        <GoogleIcon />
        {t("continueWithGoogle")}
      </Button>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("noAccount")}{" "}
        <Link href="/signup" className="font-bold text-primary hover:underline">
          {t("signup")}
        </Link>
      </p>
    </div>
  )
}
