"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Coffee, Droplet, Wheat, Candy, Boxes, TriangleAlert, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useInventory, type IngredientIcon, type InventoryLogReason } from "@/hooks/useInventory"
import { StockAdjustForm } from "@/components/admin/stock-adjust-form"

const ICONS: Record<IngredientIcon, typeof Coffee> = {
  coffee: Coffee,
  droplet: Droplet,
  wheat: Wheat,
  candy: Candy,
}

function formatLogTime(timestamp: number, locale: string): string {
  return new Date(timestamp).toLocaleString(locale === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

const REASON_LABEL_KEYS: Record<
  InventoryLogReason,
  "restockReason" | "adjustmentReason" | "wasteReason" | "orderDeductionReason"
> = {
  restock: "restockReason",
  adjustment: "adjustmentReason",
  waste: "wasteReason",
  order_deduction: "orderDeductionReason",
}

type Tab = "ingredients" | "logs"

export function InventoryManagement({ locale }: { locale: string }) {
  const t = useTranslations("AdminInventory")
  const { ingredients, logs, isLoading, error, adjustStock, setOutOfStock } = useInventory()
  const [tab, setTab] = useState<Tab>("ingredients")
  const [editingId, setEditingId] = useState<string | null>(null)

  const lowStockCount = ingredients.filter((i) => i.stock < i.threshold).length
  const lastUpdated = logs[0]?.timestamp
  const editingIngredient = ingredients.find((i) => i.id === editingId) ?? null

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <h2 className="text-2xl font-bold text-card-foreground">{t("title")}</h2>

      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{t("loadError")}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("totalIngredients")}</p>
            <p className="text-xl font-bold text-card-foreground">{ingredients.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <TriangleAlert className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("lowStockCount")}</p>
            <p className="text-xl font-bold text-card-foreground">{lowStockCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-secondary">
            <History className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("lastUpdated")}</p>
            <p className="text-lg font-semibold text-card-foreground">
              {lastUpdated ? formatLogTime(lastUpdated, locale) : t("neverUpdated")}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b">
        <button
          type="button"
          onClick={() => setTab("ingredients")}
          className={cn(
            "border-b-2 px-4 py-2 text-sm font-bold transition-colors",
            tab === "ingredients" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
          )}
        >
          {t("tabIngredients")}
        </button>
        <button
          type="button"
          onClick={() => setTab("logs")}
          className={cn(
            "border-b-2 px-4 py-2 text-sm font-bold transition-colors",
            tab === "logs" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
          )}
        >
          {t("tabLogs")}
        </button>
      </div>

      {tab === "ingredients" ? (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">{t("ingredient")}</th>
                <th className="px-4 py-3 font-medium">{t("unit")}</th>
                <th className="px-4 py-3 font-medium">{t("currentStock")}</th>
                <th className="px-4 py-3 font-medium">{t("threshold")}</th>
                <th className="px-4 py-3 font-medium">{t("status")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("adjustStock")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    {t("loadingIngredients")}
                  </td>
                </tr>
              ) : (
                ingredients.map((ingredient) => {
                const Icon = ICONS[ingredient.icon]
                const isOut = ingredient.stock <= 0
                const isLow = !isOut && ingredient.stock < ingredient.threshold
                return (
                  <tr key={ingredient.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium text-card-foreground">
                            {locale === "vi" ? ingredient.nameVi : ingredient.nameEn}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {locale === "vi" ? ingredient.subtitleVi : ingredient.subtitleEn}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{ingredient.unit}</td>
                    <td className="px-4 py-3 font-bold text-card-foreground">
                      {ingredient.stock} {ingredient.unit}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {ingredient.threshold} {ingredient.unit}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-bold",
                          isOut
                            ? "border-destructive/40 bg-destructive text-destructive-foreground"
                            : isLow
                              ? "border-destructive/20 bg-destructive/10 text-destructive"
                              : "border-green-200 bg-green-100 text-green-700"
                        )}
                      >
                        {isOut ? t("outOfStock") : isLow ? t("lowStock") : t("inStock")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" className="h-8" onClick={() => setEditingId(ingredient.id)}>
                        {t("adjustStock")}
                      </Button>
                    </td>
                  </tr>
                )
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          {logs.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("logsEmpty")}</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">{t("logDate")}</th>
                  <th className="px-4 py-3 font-medium">{t("logIngredient")}</th>
                  <th className="px-4 py-3 font-medium">{t("logChange")}</th>
                  <th className="px-4 py-3 font-medium">{t("logReason")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-3 text-muted-foreground">{formatLogTime(log.timestamp, locale)}</td>
                    <td className="px-4 py-3 font-medium text-card-foreground">
                      {locale === "vi" ? log.ingredientNameVi : log.ingredientNameEn}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 font-bold",
                        log.change >= 0 ? "text-green-600" : "text-destructive"
                      )}
                    >
                      {log.change >= 0 ? "+" : ""}
                      {log.change}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {t(REASON_LABEL_KEYS[log.reason])}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {editingIngredient && (
        <StockAdjustForm
          ingredient={editingIngredient}
          locale={locale}
          onAdd={(amount) => adjustStock(editingIngredient.id, amount, "restock")}
          onRemove={(amount) => adjustStock(editingIngredient.id, -amount, "waste")}
          onMarkOutOfStock={() => setOutOfStock(editingIngredient.id)}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  )
}
