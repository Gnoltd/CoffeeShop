"use client"

import { useCart } from "@/hooks/useCart"
import { SizeExtrasSheet, type SizeModifierSelection } from "@/components/shared/size-extras-sheet"
import type { MenuItem } from "@/lib/supabase/menu-data"

/**
 * Quick-add path for an item with a size decision and/or extras to make —
 * lets a customer configure and add without leaving the Menu grid for the
 * full Product Detail Page. Tapping the item itself (not this "+" popup)
 * still opens the full page (for reviews, notes, etc).
 */
export function QuickAddPopup({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const { addItem } = useCart()

  function handleAdd(selection: SizeModifierSelection) {
    addItem({
      menuItemId: item.id,
      nameVi: item.nameVi,
      nameEn: item.nameEn,
      size: selection.size ? { id: selection.size.id, label: selection.size.name, priceDelta: selection.size.priceDelta } : undefined,
      modifiers: selection.cartModifiers,
      unitPrice: selection.unitPrice,
    })
  }

  return <SizeExtrasSheet item={item} onAdd={handleAdd} onClose={onClose} />
}
