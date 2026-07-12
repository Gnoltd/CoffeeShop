"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { X, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Ingredient } from "@/hooks/useInventory"

export function StockAdjustForm({
  ingredient,
  locale,
  onAdd,
  onRemove,
  onMarkOutOfStock,
  onClose,
}: {
  ingredient: Ingredient
  locale: string
  onAdd: (amount: number) => void
  onRemove: (amount: number) => void
  onMarkOutOfStock: () => void
  onClose: () => void
}) {
  const t = useTranslations("AdminInventory")
  const [amount, setAmount] = useState("")
  const [error, setError] = useState<string | null>(null)

  const name = locale === "vi" ? ingredient.nameVi : ingredient.nameEn
  const parsedAmount = Number(amount)
  const isValidAmount = amount.trim() !== "" && Number.isFinite(parsedAmount) && parsedAmount > 0

  function handleAdd() {
    if (!isValidAmount) {
      setError(t("amountRequiredError"))
      return
    }
    onAdd(parsedAmount)
    onClose()
  }

  function handleRemove() {
    if (!isValidAmount) {
      setError(t("amountRequiredError"))
      return
    }
    onRemove(parsedAmount)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="nb-border nb-shadow flex w-full max-w-sm flex-col overflow-hidden rounded-xl bg-card">
        <div className="nb-border border-x-0 border-t-0 flex items-center justify-between px-6 py-4">
          <h2 className="text-lg font-bold text-card-foreground">{t("adjustStockTitle")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="nb-border-sm nb-press-sm rounded-full bg-card p-1 text-muted-foreground"
            aria-label={t("close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-4">
          <div>
            <p className="font-bold text-card-foreground">{name}</p>
            <p className="text-sm text-muted-foreground">
              {t("currentStockLabel")}: {ingredient.stock} {ingredient.unit}
            </p>
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <div className="space-y-1.5">
            <label htmlFor="stock-amount" className="text-xs font-medium text-muted-foreground">
              {t("amountLabel")} ({ingredient.unit})
            </label>
            <Input
              id="stock-amount"
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => {
                setError(null)
                setAmount(e.target.value)
              }}
              placeholder="0"
              className="h-10"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="neubrutal" onClick={handleAdd} className="h-10">
              {t("addStock")}
            </Button>
            <Button variant="neubrutal" onClick={handleRemove} className="h-10 bg-card text-foreground">
              {t("removeStock")}
            </Button>
          </div>

          <div className="nb-border border-x-0 border-b-0 pt-4">
            <Button
              onClick={() => {
                onMarkOutOfStock()
                onClose()
              }}
              variant="neubrutal"
              className="h-10 w-full gap-2 bg-card text-destructive"
            >
              <TriangleAlert className="h-4 w-4" />
              {t("markOutOfStock")}
            </Button>
          </div>
        </div>

        <div className="nb-border border-x-0 border-b-0 flex justify-end gap-2 px-6 py-4">
          <Button variant="neubrutal" className="bg-card text-foreground" onClick={onClose}>
            {t("close")}
          </Button>
        </div>
      </div>
    </div>
  )
}
