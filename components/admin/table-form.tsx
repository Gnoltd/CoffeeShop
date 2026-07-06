"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { TableInput } from "@/hooks/useTables"

export function TableForm({
  onCancel,
  onSave,
}: {
  onCancel: () => void
  onSave: (input: TableInput) => Promise<void>
}) {
  const t = useTranslations("AdminTables")
  const [number, setNumber] = useState("")
  const [locationVi, setLocationVi] = useState("")
  const [locationEn, setLocationEn] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  async function handleSave() {
    if (!number.trim()) {
      setError(t("tableNumberRequiredError"))
      return
    }
    setError(null)
    setIsSaving(true)
    try {
      await onSave({ number: number.trim(), locationVi: locationVi.trim(), locationEn: locationEn.trim() })
    } catch {
      setError(t("tableNumberTakenError"))
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-sm flex-col overflow-hidden rounded-xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-bold text-card-foreground">{t("addTable")}</h2>
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
          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t("tableNumberLabel")}</label>
            <Input value={number} onChange={(e) => setNumber(e.target.value)} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t("locationViLabel")}</label>
            <Input value={locationVi} onChange={(e) => setLocationVi(e.target.value)} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t("locationEnLabel")}</label>
            <Input value={locationEn} onChange={(e) => setLocationEn(e.target.value)} className="h-10" />
          </div>
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
