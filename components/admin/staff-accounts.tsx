"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { User, Lock, LockOpen, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type StaffRole = "admin" | "manager" | "staff"

type StaffMember = {
  id: string
  name: string
  email: string
  role: StaffRole
  active: boolean
}

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

export function StaffAccounts() {
  const t = useTranslations("AdminStaff")
  const [staff, setStaff] = useState(INITIAL_STAFF)

  function toggleActive(id: string) {
    setStaff((prev) => prev.map((member) => (member.id === id ? { ...member, active: !member.active } : member)))
  }

  const roleLabel = (role: StaffRole) =>
    role === "admin" ? t("roleAdmin") : role === "manager" ? t("roleManager") : t("roleStaff")

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-card-foreground">{t("title")}</h2>
        <Button className="h-10 gap-2" disabled title="Not implemented yet — no profiles table to write to">
          <Plus className="h-4 w-4" />
          {t("addStaff")}
        </Button>
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
            {staff.map((member) => (
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
