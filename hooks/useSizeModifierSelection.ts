import { useState } from "react"
import type { MenuItem, MenuItemSize, MenuModifierGroup, MenuModifierOption } from "@/lib/supabase/menu-data"

export type SelectedModifierOption = {
  group: MenuModifierGroup
  option: MenuModifierOption
}

export type SizeModifierSelectionState = {
  selectedSizeId: string | null
  setSelectedSizeId: (id: string) => void
  selectedModifiers: Record<string, string>
  toggleModifier: (group: MenuModifierGroup, optionId: string) => void
  selectedSize: MenuItemSize | undefined
  selectedOptions: SelectedModifierOption[]
  price: number
  extraGroups: MenuModifierGroup[]
  otherGroups: MenuModifierGroup[]
}

/**
 * Size/modifier selection state shared by every "add this item" surface
 * (Product Detail, QuickAddPopup, POS's picker): default size, default
 * required-group picks, price calc, and the extras-vs-other-groups split
 * (single-option groups render as one checkbox list, multi-option groups
 * as a grid). A single-option group is always freely toggleable even when
 * `required`; a multi-option `required` group can't be fully deselected —
 * that asymmetry is intentional and preserved from the pre-unification code.
 */
export function useSizeModifierSelection(item: MenuItem): SizeModifierSelectionState {
  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(
    item.hasSizeOptions ? item.sizes.find((s) => s.priceDelta === 0)?.id ?? item.sizes[0]?.id ?? null : null
  )
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {}
    item.modifierGroups.forEach((group) => {
      if (group.required) defaults[group.id] = group.options[0].id
    })
    return defaults
  })

  function toggleModifier(group: MenuModifierGroup, optionId: string) {
    setSelectedModifiers((prev) => {
      const isExtra = group.options.length === 1
      if ((isExtra || !group.required) && prev[group.id] === optionId) {
        const next = { ...prev }
        delete next[group.id]
        return next
      }
      return { ...prev, [group.id]: optionId }
    })
  }

  const selectedSize = item.sizes.find((s) => s.id === selectedSizeId)
  const selectedOptions: SelectedModifierOption[] = Object.entries(selectedModifiers).map(([groupId, optionId]) => {
    const group = item.modifierGroups.find((g) => g.id === groupId)!
    const option = group.options.find((o) => o.id === optionId)!
    return { group, option }
  })
  const sizeDelta = selectedSize?.priceDelta ?? 0
  const modifierDelta = selectedOptions.reduce((sum, { option }) => sum + option.priceDelta, 0)
  const price = item.basePrice + sizeDelta + modifierDelta
  const extraGroups = item.modifierGroups.filter((g) => g.options.length === 1)
  const otherGroups = item.modifierGroups.filter((g) => g.options.length > 1)

  return {
    selectedSizeId,
    setSelectedSizeId,
    selectedModifiers,
    toggleModifier,
    selectedSize,
    selectedOptions,
    price,
    extraGroups,
    otherGroups,
  }
}
