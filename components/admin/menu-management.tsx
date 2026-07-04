"use client"

import { useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Coffee, CupSoda, Cookie, Milk, Search, Plus, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatVND } from "@/lib/format"
import { menuCategories, menuItems as initialMenuItems, type MenuIcon } from "@/lib/mock-data/menu"

const ICONS: Record<MenuIcon, typeof Coffee> = {
  coffee: Coffee,
  "cup-soda": CupSoda,
  cookie: Cookie,
  milk: Milk,
}

export function MenuManagement() {
  const locale = useLocale()
  const t = useTranslations("AdminMenu")

  const [items, setItems] = useState(initialMenuItems)
  const [availability, setAvailability] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initialMenuItems.map((item) => [item.id, item.isAvailable]))
  )
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const categoryLabel = (id: string) => {
    const category = menuCategories.find((c) => c.id === id)
    if (!category) return id
    return locale === "vi" ? category.labelVi : category.labelEn
  }

  const visibleItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return items.filter((item) => {
      const matchesCategory = !selectedCategory || item.categoryId === selectedCategory
      const matchesQuery =
        query === "" || item.nameVi.toLowerCase().includes(query) || item.nameEn.toLowerCase().includes(query)
      return matchesCategory && matchesQuery
    })
  }, [items, selectedCategory, searchQuery])

  function toggleAvailability(id: string) {
    setAvailability((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-card-foreground">{t("title")}</h2>
        <Button className="h-10 gap-2" disabled title="Not implemented yet — no menu_items table to write to">
          <Plus className="h-4 w-4" />
          {t("addItem")}
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-10 pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              selectedCategory === null
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent/30"
            )}
          >
            {t("allCategories")}
          </button>
          {menuCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedCategory(category.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                selectedCategory === category.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent/30"
              )}
            >
              {locale === "vi" ? category.labelVi : category.labelEn}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">{t("item")}</th>
              <th className="px-4 py-3 font-medium">{t("price")}</th>
              <th className="px-4 py-3 font-medium">{t("available")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visibleItems.map((item) => {
              const Icon = ICONS[item.icon]
              const isAvailable = availability[item.id]
              return (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-bold text-card-foreground">
                          {locale === "vi" ? item.nameVi : item.nameEn}
                        </p>
                        <p className="text-xs text-muted-foreground">{categoryLabel(item.categoryId)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold text-primary">{formatVND(item.basePrice)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isAvailable}
                      onClick={() => toggleAvailability(item.id)}
                      className={cn(
                        "relative h-6 w-11 rounded-full transition-colors",
                        isAvailable ? "bg-primary" : "bg-muted-foreground/30"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                          isAvailable ? "translate-x-[22px]" : "translate-x-0.5"
                        )}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
