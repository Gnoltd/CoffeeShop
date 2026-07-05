"use client"

import { useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { User, Lock, LockOpen, Plus, Pencil, Users, UserCheck, UserX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { StaffMemberForm, type StaffMember, type StaffRole } from "@/components/admin/staff-member-form"

/** No `profiles` table yet — fixed mock accounts matching the Stitch mockup's example roles. */
const INITIAL_STAFF: StaffMember[] = [
  { id: "PC-8821", name: "Nguyễn Thu Hà", email: "thuha.nguyen@phadincoffee.vn", role: "admin", active: true },
  { id: "PC-7732", name: "Lê Hoàng Nam", email: "nam.le@phadincoffee.vn", role: "manager", active: true },
  { id: "PC-6510", name: "Trần Minh Khôi", email: "khoi.tran@phadincoffee.vn", role: "staff", active: false },
  { id: "PC-6488", name: "Phạm Bảo Ngọc", email: "ngoc.pham@phadincoffee.vn", role: "staff", active: true },
]

const ROLE_STYLES: Record<StaffRole, string> = {
  admin: "border-primary/20 bg-primary/10 text-primary",
  manager: "border-secondary/20 bg-secondary/10 text-secondary",
  staff: "border-accent/40 bg-accent/20 text-accent-foreground",
}

const PAGE_SIZE = 5

type FormMode = { type: "add" } | { type: "edit"; member: StaffMember } | null

export function StaffAccounts() {
  const t = useTranslations("AdminStaff")
  const [staff, setStaff] = useState(INITIAL_STAFF)
  const [formMode, setFormMode] = useState<FormMode>(null)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    setCurrentPage(1)
  }, [staff.length])

  const totalPages = Math.max(1, Math.ceil(staff.length / PAGE_SIZE))
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const pagedStaff = useMemo(() => staff.slice(pageStart, pageStart + PAGE_SIZE), [staff, pageStart])

  const activeCount = staff.filter((member) => member.active).length

  function toggleActive(id: string) {
    setStaff((prev) => prev.map((member) => (member.id === id ? { ...member, active: !member.active } : member)))
  }

  function saveMember(member: StaffMember) {
    setStaff((prev) =>
      prev.some((existing) => existing.id === member.id)
        ? prev.map((existing) => (existing.id === member.id ? member : existing))
        : [member, ...prev]
    )
    setFormMode(null)
  }

  const roleLabel = (role: StaffRole) =>
    role === "admin" ? t("roleAdmin") : role === "manager" ? t("roleManager") : t("roleStaff")

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-card-foreground">{t("title")}</h2>
        <Button className="h-10 gap-2" onClick={() => setFormMode({ type: "add" })}>
          <Plus className="h-4 w-4" />
          {t("addStaff")}
        </Button>
      </div>

      {formMode && (
        <StaffMemberForm
          initialMember={formMode.type === "edit" ? formMode.member : undefined}
          onCancel={() => setFormMode(null)}
          onSave={saveMember}
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("totalStaff")}</p>
            <p className="text-xl font-bold text-card-foreground">{staff.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("activeCount")}</p>
            <p className="text-xl font-bold text-card-foreground">{activeCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <UserX className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("inactiveCount")}</p>
            <p className="text-xl font-bold text-card-foreground">{staff.length - activeCount}</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">{t("name")}</th>
              <th className="px-4 py-3 font-medium">{t("email")}</th>
              <th className="px-4 py-3 font-medium">{t("role")}</th>
              <th className="px-4 py-3 font-medium">{t("status")}</th>
              <th className="px-4 py-3 text-right font-medium">
                <span className="sr-only">{t("status")}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pagedStaff.map((member) => (
              <tr key={member.id} className={cn(!member.active && "opacity-60")}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-card-foreground">{member.name}</p>
                      <p className="text-xs text-muted-foreground">ID: {member.id}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{member.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
                      ROLE_STYLES[member.role]
                    )}
                  >
                    {roleLabel(member.role)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 rounded-full", member.active ? "bg-green-500" : "bg-muted-foreground")} />
                    <span className="text-card-foreground">{member.active ? t("active") : t("disabled")}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setFormMode({ type: "edit", member })}
                      aria-label={t("edit")}
                      title={t("edit")}
                      className="rounded-lg p-2 text-secondary transition-colors hover:bg-secondary/10"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActive(member.id)}
                      className={cn(
                        "rounded-lg p-2 transition-colors",
                        member.active
                          ? "text-destructive hover:bg-destructive/10"
                          : "text-green-600 hover:bg-green-100"
                      )}
                      title={member.active ? t("disabled") : t("active")}
                    >
                      {member.active ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex flex-col items-center justify-between gap-3 border-t bg-muted/40 px-4 py-3 sm:flex-row">
          <span className="text-xs text-muted-foreground">
            {t("showingItems", {
              start: staff.length === 0 ? 0 : pageStart + 1,
              end: Math.min(pageStart + PAGE_SIZE, staff.length),
              total: staff.length,
            })}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
            >
              {t("previous")}
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={cn(
                  "rounded-lg border px-3 py-1 text-xs font-medium transition-colors",
                  page === currentPage
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-lg border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
            >
              {t("next")}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
