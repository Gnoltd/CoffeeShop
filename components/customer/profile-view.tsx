"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { useParams } from "next/navigation"
import {
  User,
  Pencil,
  Check,
  X,
  ReceiptText,
  Star,
  MapPin,
  Languages,
  Settings,
  LogOut,
  ChevronRight,
  LayoutDashboard,
} from "lucide-react"
import { Link, usePathname, useRouter } from "@/i18n/navigation"
import { formatNumber } from "@/lib/format"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { ROLE_HOME } from "@/lib/roles"

/** Matches loyalty-view.tsx's mock balance — no real profile/loyalty tables yet. */
const MOCK_POINTS_BALANCE = 1250

type Field = "name" | "phone" | "email"

const INITIAL_PROFILE: Record<Field, string> = {
  name: "Nguyễn Văn An",
  phone: "+84 901 234 567",
  email: "an.nguyen@email.com",
}

const FIELD_LABEL_KEYS: Record<Field, "fullName" | "phoneNumber" | "email"> = {
  name: "fullName",
  phone: "phoneNumber",
  email: "email",
}

export function ProfileView({ role = null }: { role?: string | null }) {
  const t = useTranslations("Profile")
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const isStaffRole = role === "staff" || role === "manager" || role === "admin"

  const [profile, setProfile] = useState(INITIAL_PROFILE)
  const [editingField, setEditingField] = useState<Field | null>(null)
  const [draft, setDraft] = useState("")

  function startEdit(field: Field) {
    setEditingField(field)
    setDraft(profile[field])
  }

  function saveEdit() {
    if (!editingField) return
    const trimmed = draft.trim()
    if (trimmed) setProfile((prev) => ({ ...prev, [editingField]: trimmed }))
    setEditingField(null)
  }

  function cancelEdit() {
    setEditingField(null)
  }

  function toggleLocale() {
    const nextLocale = locale === "vi" ? "en" : "vi"
    router.replace(
      // @ts-expect-error -- pathname/params are dynamic across all routes
      { pathname, params },
      { locale: nextLocale }
    )
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    // Guest ordering stays available — send them back to the menu, not /login.
    router.push("/menu")
    router.refresh()
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-4">
      <section className="mb-6 flex flex-col items-center gap-3">
        <div className="relative">
          <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-muted bg-muted">
            <User className="h-12 w-12 text-muted-foreground" />
          </div>
          <button
            type="button"
            disabled
            title="Not implemented yet — no avatar upload backend"
            className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-70 shadow-lg"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-card-foreground">{profile.name}</h2>
          <p className="text-sm text-muted-foreground">{t("memberIdLabel")}: #PDC-8829</p>
        </div>
      </section>

      {role && isStaffRole && (
        <section className="mb-6 rounded-2xl border-2 border-secondary/30 bg-secondary/10 p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/20 text-secondary">
              <LayoutDashboard className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-card-foreground">
                {role === "staff" ? t("staffAccessHeadlineStaff") : t("staffAccessHeadlineAdmin")}
              </p>
              <p className="text-sm text-muted-foreground">
                {role === "staff" ? t("staffAccessSubtextStaff") : t("staffAccessSubtextAdmin")}
              </p>
            </div>
          </div>
          <Button
            className="h-11 w-full rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80"
            render={<Link href={ROLE_HOME[role]} />}
            nativeButton={false}
          >
            {role === "staff" ? t("staffAccessButtonStaff") : t("staffAccessButtonAdmin")}
          </Button>
        </section>
      )}

      <section className="mb-6 space-y-3">
        {(["name", "phone", "email"] as Field[]).map((field) => {
          const isEditing = editingField === field
          return (
            <div key={field}>
              <label className="mb-1 block px-1 text-xs font-medium text-muted-foreground">
                {t(FIELD_LABEL_KEYS[field])}
              </label>
              {isEditing ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit()
                      if (e.key === "Escape") cancelEdit()
                    }}
                    className="h-11 flex-1 rounded-xl border-2 border-primary bg-card px-4 text-card-foreground focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={saveEdit}
                    aria-label={t("save")}
                    title={t("save")}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    aria-label={t("cancel")}
                    title={t("cancel")}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-muted-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => startEdit(field)}
                  className="flex h-11 w-full items-center justify-between rounded-xl border-2 border-transparent bg-muted px-4 text-left transition-colors hover:border-primary/40"
                >
                  <span className="text-card-foreground">{profile[field]}</span>
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          )
        })}
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <Link
          href="/orders"
          className="flex items-center justify-between border-b p-4 transition-colors hover:bg-muted"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/15 text-secondary">
              <ReceiptText className="h-5 w-5" />
            </span>
            <span className="font-medium text-card-foreground">{t("menuOrderHistory")}</span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>

        <Link
          href="/loyalty"
          className="flex items-center justify-between border-b p-4 transition-colors hover:bg-muted"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/25 text-accent-foreground">
              <Star className="h-5 w-5" />
            </span>
            <span className="font-medium text-card-foreground">{t("menuLoyalty")}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="font-bold text-primary">{formatNumber(MOCK_POINTS_BALANCE)} pts</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </span>
        </Link>

        <button
          type="button"
          disabled
          title="Not implemented yet — no addresses table"
          className="flex w-full items-center justify-between border-b p-4 text-left opacity-50"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <MapPin className="h-5 w-5" />
            </span>
            <span className="font-medium text-card-foreground">{t("menuAddresses")}</span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>

        <button
          type="button"
          onClick={toggleLocale}
          className="flex w-full items-center justify-between border-b p-4 text-left transition-colors hover:bg-muted"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Languages className="h-5 w-5" />
            </span>
            <span className="font-medium text-card-foreground">{t("menuLanguage")}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {locale === "vi" ? t("languageVi") : t("languageEn")}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </span>
        </button>

        <button
          type="button"
          disabled
          title="Not implemented yet — no customer settings page"
          className="flex w-full items-center justify-between border-b p-4 text-left opacity-50"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Settings className="h-5 w-5" />
            </span>
            <span className="font-medium text-card-foreground">{t("menuSettings")}</span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <LogOut className="h-5 w-5" />
            </span>
            <span className="font-medium text-destructive">{t("menuLogout")}</span>
          </span>
        </button>
      </section>

      <p className="mt-6 text-center text-[11px] italic text-muted-foreground">
        {t("versionFooter")}
      </p>
    </div>
  )
}
