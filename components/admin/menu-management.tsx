"use client"

import { useEffect, useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Coffee, CupSoda, Cookie, Milk, Search, Plus, Pencil, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatVND } from "@/lib/format"
import { menuCategories, menuItems as initialMenuItems, type MenuIcon, type MenuItem } from "@/lib/mock-data/menu"
import { MenuItemForm } from "@/components/admin/menu-item-form"

const ICONS: Record<MenuIcon, typeof Coffee> = {
  coffee: Coffee,
  "cup-soda": CupSoda,
  cookie: Cookie,
  milk: Milk,
}

const CATEGORY_BADGE_STYLES: Record<string, string> = {
  coffee: "bg-accent/30 text-accent-foreground",
  tea: "bg-secondary/15 text-secondary",
  pastries: "bg-primary/10 text-primary",
  blended: "bg-muted text-muted-foreground",
}

const PAGE_SIZE = 5

type FormMode = { type: "add" } | { type: "edit"; item: MenuItem } | null

export function MenuManagement() {
  const locale = useLocale()
  const t = useTranslations("AdminMenu")

  const [items, setItems] = useState(initialMenuItems)
  const [availability, setAvailability] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initialMenuItems.map((item) => [item.id, item.isAvailable]))
  )
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [formMode, setFormMode] = useState<FormMode>(null)
  const [currentPage, setCurrentPage] = useState(1)

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

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCategory, searchQuery])

  const totalPages = Math.max(1, Math.ceil(visibleItems.length / PAGE_SIZE))
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const pagedItems = visibleItems.slice(pageStart, pageStart + PAGE_SIZE)

  function toggleAvailability(id: string) {
    setAvailability((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  function saveItem(item: MenuItem) {
    setItems((prev) =>
      prev.some((existing) => existing.id === item.id)
        ? prev.map((existing) => (existing.id === item.id ? item : existing))
        : [item, ...prev]
    )
    setAvailability((prev) => ({ ...prev, [item.id]: item.isAvailable }))
    setFormMode(null)
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-card-foreground">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button className="h-10 gap-2" onClick={() => setFormMode({ type: "add" })}>
          <Plus className="h-4 w-4" />
          {t("addItem")}
        </Button>
      </div>

      {formMode && (
        <MenuItemForm
          initialItem={formMode.type === "edit" ? formMode.item : undefined}
          onCancel={() => setFormMode(null)}
          onSave={saveItem}
        />
      )}

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
              <th className="px-4 py-3 font-medium">{t("categoryLabel")}</th>
              <th className="px-4 py-3 font-medium">{t("price")}</th>
              <th className="px-4 py-3 font-medium">{t("available")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pagedItems.map((item) => {
              const Icon = ICONS[item.icon]
              const isAvailable = availability[item.id]
              return (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Icon className="h-5 w-5" />
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-card-foreground">
                          {locale === "vi" ? item.nameVi : item.nameEn}
                        </p>
                        <p className="text-xs italic text-muted-foreground">
                          {locale === "vi" ? item.nameEn : item.nameVi}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium",
                        CATEGORY_BADGE_STYLES[item.categoryId] ?? "bg-muted text-muted-foreground"
                      )}
                    >
                      {categoryLabel(item.categoryId)}
                    </span>
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
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setFormMode({ type: "edit", item })}
                        aria-label={t("edit")}
                        title={t("edit")}
                        className="rounded-lg p-2 text-secondary transition-colors hover:bg-secondary/10"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        aria-label={t("delete")}
                        title={t("delete")}
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="flex flex-col items-center justify-between gap-3 border-t bg-muted/40 px-4 py-3 sm:flex-row">
          <span className="text-xs text-muted-foreground">
            {t("showingItems", {
              start: visibleItems.length === 0 ? 0 : pageStart + 1,
              end: Math.min(pageStart + PAGE_SIZE, visibleItems.length),
              total: visibleItems.length,
            })}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
            >
              {t("previous")}
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={cn(
                  "rounded-lg border px-3 py-1 text-xs font-medium transition-colors",
                  page === currentPage
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-lg border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
            >
              {t("next")}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
