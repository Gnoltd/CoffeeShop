"use client"

import { Input } from "@/components/ui/input"
import type { Ingredient } from "@/lib/supabase/inventory-data"

export type RecipeSelection = Record<string, number>

export function RecipeChecklist({
  ingredients,
  selected,
  onChange,
  locale,
  emptyLabel,
  quantityPlaceholder,
}: {
  ingredients: Ingredient[]
  selected: RecipeSelection
  onChange: (next: RecipeSelection) => void
  locale: string
  emptyLabel: string
  quantityPlaceholder: string
}) {
  if (ingredients.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  }

  return (
    <div className="nb-border-sm space-y-2 rounded-lg bg-card p-3">
      {ingredients.map((ingredient) => {
        const checked = ingredient.id in selected
        return (
          <div key={ingredient.id} className="flex items-center justify-between gap-3 text-sm">
            <label className="flex flex-1 items-center gap-2">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  const next = { ...selected }
                  if (checked) {
                    delete next[ingredient.id]
                  } else {
                    next[ingredient.id] = 0
                  }
                  onChange(next)
                }}
                className="h-4 w-4 rounded border-input text-primary focus:ring-primary/40"
              />
              <span className="text-card-foreground">{locale === "vi" ? ingredient.nameVi : ingredient.nameEn}</span>
            </label>
            {checked && (
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={selected[ingredient.id] || ""}
                  onChange={(e) => onChange({ ...selected, [ingredient.id]: Number(e.target.value) })}
                  placeholder={quantityPlaceholder}
                  className="h-8 w-24"
                />
                <span className="text-xs text-muted-foreground">{ingredient.unit}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
