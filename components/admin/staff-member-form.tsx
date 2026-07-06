"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { StaffMember, StaffRole } from "@/lib/supabase/staff-data"

export type { StaffMember, StaffRole }

export function StaffMemberForm({
  initialMember,
  disableActiveToggle,
  onCancel,
  onSave,
}: {
  initialMember?: StaffMember
  disableActiveToggle?: boolean
  onCancel: () => void
  onSave: (input: { fullName: string; email: string; role: StaffRole; isActive: boolean }) => Promise<void>
}) {
  const t = useTranslations("AdminStaff")
  const isEditing = Boolean(initialMember)

  const [fullName, setFullName] = useState(initialMember?.fullName ?? "")
  const [email, setEmail] = useState(initialMember?.email ?? "")
  const [role, setRole] = useState<StaffRole>(initialMember?.role ?? "staff")
  const [isActive, setIsActive] = useState(initialMember?.isActive ?? true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  async function handleSave() {
    if (!fullName.trim() || !email.trim()) {
      setError(t("requiredFieldsError"))
      return
    }
    setError(null)
    setIsSaving(true)
    try {
      await onSave({ fullName: fullName.trim(), email: email.trim(), role, isActive })
    } catch {
      setError(t("saveError"))
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-bold text-card-foreground">
            {isEditing ? t("editStaffTitle") : t("addStaff")}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
            aria-label={t("cancel")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-4">
          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t("name")}</label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-10" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t("email")}</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isEditing}
              className="h-10 disabled:opacity-60"
              title={isEditing ? t("emailNotEditable") : undefined}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t("role")}</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="staff">{t("roleStaff")}</option>
              <option value="manager">{t("roleManager")}</option>
              <option value="admin">{t("roleAdmin")}</option>
            </select>
          </div>

          {isEditing && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm font-medium text-card-foreground">{t("activeToggle")}</span>
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                disabled={disableActiveToggle}
                onClick={() => setIsActive((prev) => !prev)}
                title={disableActiveToggle ? t("cannotDisableSelf") : undefined}
                className={cn(
                  "relative h-6 w-11 rounded-full transition-colors disabled:opacity-40",
                  isActive ? "bg-primary" : "bg-muted-foreground/30"
                )}
              >
                <span
                  className={cn(
                    "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                    isActive ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {t("save")}
          </Button>
        </div>
      </div>
    </div>
  )
}
