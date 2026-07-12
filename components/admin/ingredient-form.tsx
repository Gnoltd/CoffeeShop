"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { X, Coffee, Droplet, Wheat, Candy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { Ingredient, IngredientIcon, IngredientInput } from "@/hooks/useInventory"

const ICON_OPTIONS: IngredientIcon[] = ["coffee", "droplet", "wheat", "candy"]
const ICONS: Record<IngredientIcon, typeof Coffee> = {
  coffee: Coffee,
  droplet: Droplet,
  wheat: Wheat,
  candy: Candy,
}

export function IngredientForm({
  initialIngredient,
  onCancel,
  onSave,
}: {
  initialIngredient?: Ingredient
  onCancel: () => void
  onSave: (input: IngredientInput) => Promise<void>
}) {
  const t = useTranslations("AdminInventory")
  const isEditing = Boolean(initialIngredient)

  const [nameVi, setNameVi] = useState(initialIngredient?.nameVi ?? "")
  const [nameEn, setNameEn] = useState(initialIngredient?.nameEn ?? "")
  const [subtitleVi, setSubtitleVi] = useState(initialIngredient?.subtitleVi ?? "")
  const [subtitleEn, setSubtitleEn] = useState(initialIngredient?.subtitleEn ?? "")
  const [unit, setUnit] = useState(initialIngredient?.unit ?? "")
  const [threshold, setThreshold] = useState(initialIngredient ? String(initialIngredient.threshold) : "")
  const [icon, setIcon] = useState<IngredientIcon>(initialIngredient?.icon ?? "coffee")
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  async function handleSave() {
    const parsedThreshold = Number(threshold)
    if (
      !nameVi.trim() ||
      !nameEn.trim() ||
      !subtitleVi.trim() ||
      !subtitleEn.trim() ||
      !unit.trim() ||
      !Number.isFinite(parsedThreshold) ||
      parsedThreshold < 0
    ) {
      setError(t("ingredientRequiredFieldsError"))
      return
    }
    setError(null)
    setIsSaving(true)
    try {
      await onSave({
        nameVi: nameVi.trim(),
        nameEn: nameEn.trim(),
        subtitleVi: subtitleVi.trim(),
        subtitleEn: subtitleEn.trim(),
        unit: unit.trim(),
        threshold: parsedThreshold,
        icon,
      })
    } catch {
      setError(t("ingredientSaveError"))
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="nb-border nb-shadow flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-card">
        <div className="nb-border border-x-0 border-t-0 flex items-center justify-between px-6 py-4">
          <h2 className="text-lg font-bold text-card-foreground">
            {isEditing ? t("editIngredientTitle") : t("addIngredientTitle")}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="nb-border-sm nb-press-sm rounded-full bg-card p-1 text-muted-foreground"
            aria-label={t("close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("ingredientNameViLabel")}</label>
              <Input value={nameVi} onChange={(e) => setNameVi(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("ingredientNameEnLabel")}</label>
              <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} className="h-10" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("ingredientSubtitleViLabel")}</label>
              <Input value={subtitleVi} onChange={(e) => setSubtitleVi(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("ingredientSubtitleEnLabel")}</label>
              <Input value={subtitleEn} onChange={(e) => setSubtitleEn(e.target.value)} className="h-10" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("ingredientUnitLabel")}</label>
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder={t("ingredientUnitPlaceholder")}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("threshold")}</label>
              <Input type="number" min={0} value={threshold} onChange={(e) => setThreshold(e.target.value)} className="h-10" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t("ingredientIconLabel")}</label>
            <div className="flex gap-2">
              {ICON_OPTIONS.map((option) => {
                const Icon = ICONS[option]
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setIcon(option)}
                    aria-pressed={icon === option}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg border-2 transition-colors",
                      icon === option ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="nb-border border-x-0 border-b-0 flex justify-end gap-2 px-6 py-4">
          <Button variant="neubrutal" className="bg-card text-foreground" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button variant="neubrutal" onClick={handleSave} disabled={isSaving}>
            {t("save")}
          </Button>
        </div>
      </div>
    </div>
  )
}
