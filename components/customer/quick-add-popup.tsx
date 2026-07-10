"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatVND } from "@/lib/format"
import { useCart, type CartModifier } from "@/hooks/useCart"
import { BottomSheet } from "@/components/motion/bottom-sheet"
import { SegmentedControl } from "@/components/motion/segmented-control"
import { PressFeedback } from "@/components/motion/press-feedback"
import type { MenuItem } from "@/lib/supabase/menu-data"

/**
 * Quick-add path for an item with a size decision and/or extras to make —
 * lets a customer configure and add without leaving the Menu grid for the
 * full Product Detail Page. Tapping the item itself (not this "+" popup)
 * still opens the full page (for reviews, notes, etc). Mirrors Product
 * Detail's size/modifier selection logic exactly (default size, required-
 * group defaults, price calc) so the two stay in sync.
 */
export function QuickAddPopup({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const locale = useLocale()
  const t = useTranslations("Menu")
  const { addItem } = useCart()

  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(
    item.hasSizeOptions ? item.sizes?.find((s) => s.priceDelta === 0)?.id ?? item.sizes?.[0]?.id ?? null : null
  )
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {}
    item.modifierGroups.forEach((group) => {
      if (group.required) defaults[group.id] = group.options[0].id
    })
    return defaults
  })

  const sizeDelta = item.sizes?.find((s) => s.id === selectedSizeId)?.priceDelta ?? 0
  const modifierDelta = Object.entries(selectedModifiers).reduce((sum, [groupId, optionId]) => {
    const group = item.modifierGroups.find((g) => g.id === groupId)
    const option = group?.options.find((o) => o.id === optionId)
    return sum + (option?.priceDelta ?? 0)
  }, 0)
  const price = item.basePrice + sizeDelta + modifierDelta
  const extraGroups = item.modifierGroups.filter((g) => g.options.length === 1)
  const otherGroups = item.modifierGroups.filter((g) => g.options.length > 1)

  function handleAdd() {
    const size = item.sizes?.find((s) => s.id === selectedSizeId)
    const modifiers: CartModifier[] = Object.entries(selectedModifiers).map(([groupId, optionId]) => {
      const group = item.modifierGroups.find((g) => g.id === groupId)!
      const option = group.options.find((o) => o.id === optionId)!
      return {
        groupId,
        optionId,
        labelVi: option.nameVi,
        labelEn: option.nameEn,
        priceDelta: option.priceDelta,
      }
    })
    addItem({
      menuItemId: item.id,
      nameVi: item.nameVi,
      nameEn: item.nameEn,
      size: size ? { id: size.id, label: size.name, priceDelta: size.priceDelta } : undefined,
      modifiers,
      unitPrice: price,
    })
    onClose()
  }

  return (
    <BottomSheet onClose={onClose}>
      <div className="flex items-center justify-between border-b px-5 py-4">
        <h2 className="font-bold text-card-foreground">
          {locale === "vi" ? item.nameVi : item.nameEn}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          aria-label={t("close")}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-5 py-4">
        {item.hasSizeOptions && item.sizes.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("size")}
            </span>
            <SegmentedControl
              variant="tabs"
              layoutId="quick-add-size-pill"
              value={selectedSizeId ?? ""}
              onChange={setSelectedSizeId}
              options={item.sizes.map((size) => ({ value: size.id, label: size.name }))}
            />
          </div>
        )}

        {extraGroups.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("extrasLabel")}
            </span>
            <div className="flex flex-col gap-2">
              {extraGroups.map((group) => {
                const option = group.options[0]
                const selected = selectedModifiers[group.id] === option.id
                return (
                  <PressFeedback
                    key={group.id}
                    type="button"
                    onClick={() =>
                      setSelectedModifiers((prev) => {
                        if (prev[group.id] === option.id) {
                          const next = { ...prev }
                          delete next[group.id]
                          return next
                        }
                        return { ...prev, [group.id]: option.id }
                      })
                    }
                    className={cn(
                      "flex items-center justify-between rounded-lg border-2 px-3 py-2 text-sm transition-colors",
                      selected
                        ? "border-primary bg-primary/10 font-semibold text-card-foreground"
                        : "border-border text-card-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Check className={cn("h-4 w-4 shrink-0", selected ? "text-primary" : "text-transparent")} />
                      <span>{locale === "vi" ? option.nameVi : option.nameEn}</span>
                    </div>
                    <span className={selected ? "text-primary" : "text-muted-foreground"}>
                      {option.priceDelta > 0 ? `+${formatVND(option.priceDelta)}` : t("freeLabel")}
                    </span>
                  </PressFeedback>
                )
              })}
            </div>
          </div>
        )}

        {otherGroups.map((group) => (
          <div key={group.id} className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {locale === "vi" ? group.nameVi : group.nameEn}
            </span>
            <div className="grid grid-cols-2 gap-2">
              {group.options.map((option) => {
                const selected = selectedModifiers[group.id] === option.id
                return (
                  <PressFeedback
                    key={option.id}
                    type="button"
                    onClick={() =>
                      setSelectedModifiers((prev) => {
                        if (!group.required && prev[group.id] === option.id) {
                          const next = { ...prev }
                          delete next[group.id]
                          return next
                        }
                        return { ...prev, [group.id]: option.id }
                      })
                    }
                    className={cn(
                      "flex flex-col items-start gap-0.5 rounded-lg border-2 px-3 py-2 text-sm transition-colors",
                      selected
                        ? "border-primary bg-primary/10 font-semibold text-card-foreground"
                        : "border-border text-card-foreground"
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span>{locale === "vi" ? option.nameVi : option.nameEn}</span>
                      {selected && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {option.priceDelta > 0 ? `+${formatVND(option.priceDelta)}` : t("freeLabel")}
                    </span>
                  </PressFeedback>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t px-5 py-4">
        <span className="text-lg font-bold text-primary">{formatVND(price)}</span>
        <Button onClick={handleAdd} className="h-11 rounded-xl px-6 font-bold">
          {t("add")}
        </Button>
      </div>
    </BottomSheet>
  )
}
