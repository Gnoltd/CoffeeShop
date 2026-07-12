"use client"

import { SizeExtrasSheet, type SizeModifierSelection } from "@/components/shared/size-extras-sheet"
import type { MenuItem } from "@/lib/supabase/menu-data"

export type PosPickerSelection = {
  sizeId: string | null
  sizeName: string | null
  modifierIds: string[]
  modifierNames: string[]
  unitPrice: number
}

/**
 * POS's size/extras picker for an item that has size options and/or
 * modifier groups — reports the selection back via onAdd instead of
 * writing to useCart (POS keeps its own local order state, a separate
 * staff-side transaction).
 */
export function PosItemPicker({
  item,
  onAdd,
  onClose,
}: {
  item: MenuItem
  onAdd: (selection: PosPickerSelection) => void
  onClose: () => void
}) {
  function handleAdd(selection: SizeModifierSelection) {
    onAdd({
      sizeId: selection.size?.id ?? null,
      sizeName: selection.size?.name ?? null,
      modifierIds: selection.modifierIds,
      modifierNames: selection.modifierNames,
      unitPrice: selection.unitPrice,
    })
  }

  return <SizeExtrasSheet item={item} onAdd={handleAdd} onClose={onClose} />
}
