"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Coffee, User, Mail, Phone, Lock, Eye, EyeOff, ArrowRight } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GoogleIcon } from "@/components/auth/google-icon"

export function SignupForm() {
  const t = useTranslations("Auth")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="mx-auto w-full max-w-sm px-4">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
          <Coffee className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-card-foreground">{t("signup")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("signupWelcome")}</p>
        </div>
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="signup-name" className="block px-1 text-xs font-medium text-muted-foreground">
            {t("fullNameLabel")}
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="signup-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("fullNamePlaceholder")}
              className="h-12 rounded-xl pl-10"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="signup-email" className="block px-1 text-xs font-medium text-muted-foreground">
            {t("emailLabel")}
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="h-12 rounded-xl pl-10"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="signup-phone" className="block px-1 text-xs font-medium text-muted-foreground">
            {t("phoneLabel")}
          </label>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="signup-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("phonePlaceholder")}
              className="h-12 rounded-xl pl-10"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="signup-password" className="block px-1 text-xs font-medium text-muted-foreground">
            {t("passwordLabel")}
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-12 rounded-xl pl-10 pr-11"
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
        </div>

        <p className="px-1 text-center text-[11px] leading-relaxed text-muted-foreground">
          {t("termsText")}
        </p>

        <Button
          type="submit"
          disabled
          title="Not implemented yet — Supabase Auth not wired up"
          className="h-12 w-full gap-2 rounded-xl text-base font-bold"
        >
          {t("createAccount")}
          <ArrowRight className="h-4 w-4" />
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
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-bold text-primary hover:underline">
          {t("login")}
        </Link>
      </p>
    </div>
  )
}
