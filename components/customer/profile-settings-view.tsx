"use client"

import { useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import type { UserIdentity } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

export function ProfileSettingsView() {
  const t = useTranslations("Profile")
  const locale = useLocale()
  const searchParams = useSearchParams()

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  const [identities, setIdentities] = useState<UserIdentity[]>([])
  const [identitiesError, setIdentitiesError] = useState<string | null>(null)
  const [isLoadingIdentities, setIsLoadingIdentities] = useState(true)

  function loadIdentities() {
    const supabase = createClient()
    supabase.auth.getUserIdentities().then(({ data, error }) => {
      if (!error && data) setIdentities(data.identities)
      setIsLoadingIdentities(false)
    })
  }

  useEffect(() => {
    const oauthError = searchParams.get("error_description") ?? searchParams.get("error")
    if (oauthError) setIdentitiesError(oauthError)
    loadIdentities()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handlePasswordUpdate() {
    setPasswordError(null)
    setPasswordSuccess(false)
    if (newPassword.length < 6) {
      setPasswordError(t("passwordTooShortError"))
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("passwordMismatchError"))
      return
    }
    setIsSavingPassword(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setIsSavingPassword(false)
    if (error) {
      setPasswordError(t("passwordUpdateError"))
      return
    }
    setNewPassword("")
    setConfirmPassword("")
    setPasswordSuccess(true)
  }

  async function handleConnectGoogle() {
    const supabase = createClient()
    await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/${locale}/profile/settings` },
    })
  }

  async function handleUnlinkGoogle(identity: UserIdentity) {
    setIdentitiesError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.unlinkIdentity(identity)
    if (error) {
      setIdentitiesError(t("unlinkError"))
      return
    }
    loadIdentities()
  }

  const googleIdentity = identities.find((i) => i.provider === "google")

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-4 md:max-w-5xl md:px-8">
      <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:items-start md:gap-8">
        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-card-foreground">{t("changePasswordTitle")}</h2>
          {passwordError && (
            <p className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{passwordError}</p>
          )}
          {passwordSuccess && (
            <p className="mb-3 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{t("passwordUpdateSuccess")}</p>
          )}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="block px-1 text-xs font-medium text-muted-foreground">{t("newPasswordLabel")}</label>
              <input
                type="password"
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-11 w-full rounded-xl border border-input bg-background px-4 text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block px-1 text-xs font-medium text-muted-foreground">
                {t("confirmPasswordLabel")}
              </label>
              <input
                type="password"
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-11 w-full rounded-xl border border-input bg-background px-4 text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <Button onClick={handlePasswordUpdate} disabled={isSavingPassword} className="h-11 w-full rounded-xl">
              {t("updatePasswordButton")}
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-card-foreground">{t("connectedAccountsTitle")}</h2>
          {identitiesError && (
            <p className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{identitiesError}</p>
          )}
          {!isLoadingIdentities && (
            <div className="flex items-center justify-between rounded-xl border p-3">
              <span className="font-medium text-card-foreground">Google</span>
              {googleIdentity ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-primary">{t("connectedLabel")}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={identities.length <= 1}
                    onClick={() => handleUnlinkGoogle(googleIdentity)}
                  >
                    {t("unlinkButton")}
                  </Button>
                </div>
              ) : (
                <Button size="sm" onClick={handleConnectGoogle}>
                  {t("connectGoogleButton")}
                </Button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
