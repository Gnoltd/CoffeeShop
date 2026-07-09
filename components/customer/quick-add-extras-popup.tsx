"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatVND } from "@/lib/format"
import { useCart, type CartModifier } from "@/hooks/useCart"
import { BottomSheet } from "@/components/motion/bottom-sheet"
import { PressFeedback } from "@/components/motion/press-feedback"
import type { MenuItem } from "@/lib/supabase/menu-data"

/**
 * Quick-add path for an item with extras but no size decision to make —
 * lets a customer pick extras without leaving the Menu grid for the full
 * Product Detail Page. Tapping the item itself (not this "+" popup)
 * still opens the full page. Extras are always non-required single-
 * option modifier_groups (see menu-data.ts), so the same toggle-any-
 * count-independently selection logic as Product Detail applies.
 */
export function QuickAddExtrasPopup({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const locale = useLocale()
  const t = useTranslations("Menu")
  const { addItem } = useCart()
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string>>({})

  const modifierDelta = Object.entries(selectedModifiers).reduce((sum, [groupId, optionId]) => {
    const group = item.modifierGroups.find((g) => g.id === groupId)
    const option = group?.options.find((o) => o.id === optionId)
    return sum + (option?.priceDelta ?? 0)
  }, 0)
  const price = item.basePrice + modifierDelta

  function handleAdd() {
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

      <div className="flex flex-col gap-4 px-5 py-4">
        {item.modifierGroups.map((group) => (
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
                    <span>{locale === "vi" ? option.nameVi : option.nameEn}</span>
                    {selected && <Check className="h-4 w-4 text-primary" />}
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
