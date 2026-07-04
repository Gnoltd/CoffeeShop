"use client"

import { useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Coffee, CupSoda, Cookie, Milk, Search, Plus, Check, Ban } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatVND } from "@/lib/format"
import { useCart, type CartModifier } from "@/hooks/useCart"
import {
  menuCategories,
  menuItems,
  type MenuIcon,
  type MenuItem,
} from "@/lib/mock-data/menu"

const ICONS: Record<MenuIcon, typeof Coffee> = {
  coffee: Coffee,
  "cup-soda": CupSoda,
  cookie: Cookie,
  milk: Milk,
}

function ItemImagePlaceholder({ icon, className }: { icon: MenuIcon; className?: string }) {
  const Icon = ICONS[icon]
  return (
    <div className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}>
      <Icon className="h-8 w-8" />
    </div>
  )
}

export function MenuBrowser() {
  const locale = useLocale()
  const t = useTranslations("Menu")
  const { addItem, itemCount, subtotal } = useCart()

  const [selectedCategory, setSelectedCategory] = useState(menuCategories[0].id)
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(null)
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string>>({})

  const name = (item: MenuItem) => (locale === "vi" ? item.nameVi : item.nameEn)
  const description = (item: MenuItem) => (locale === "vi" ? item.descriptionVi : item.descriptionEn)
  const categoryLabel = (c: (typeof menuCategories)[number]) => (locale === "vi" ? c.labelVi : c.labelEn)

  const visibleItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return menuItems.filter((item) => {
      const matchesCategory = item.categoryId === selectedCategory
      const matchesQuery =
        query === "" ||
        item.nameVi.toLowerCase().includes(query) ||
        item.nameEn.toLowerCase().includes(query)
      return matchesCategory && matchesQuery
    })
  }, [selectedCategory, searchQuery])

  function openItem(item: MenuItem) {
    if (!item.isAvailable) return
    if (expandedItemId === item.id) {
      setExpandedItemId(null)
      return
    }
    setExpandedItemId(item.id)
    setSelectedSizeId(item.sizes?.find((s) => s.priceDelta === 0)?.id ?? item.sizes?.[0]?.id ?? null)
    const defaults: Record<string, string> = {}
    item.modifierGroups?.forEach((group) => {
      if (group.required) defaults[group.id] = group.options[0].id
    })
    setSelectedModifiers(defaults)
  }

  function priceFor(item: MenuItem, sizeId: string | null, modifiers: Record<string, string>): number {
    const sizeDelta = item.sizes?.find((s) => s.id === sizeId)?.priceDelta ?? 0
    const modifierDelta = Object.entries(modifiers).reduce((sum, [groupId, optionId]) => {
      const group = item.modifierGroups?.find((g) => g.id === groupId)
      const option = group?.options.find((o) => o.id === optionId)
      return sum + (option?.priceDelta ?? 0)
    }, 0)
    return item.basePrice + sizeDelta + modifierDelta
  }

  function confirmAdd(item: MenuItem) {
    const size = item.sizes?.find((s) => s.id === selectedSizeId)
    const modifiers: CartModifier[] = Object.entries(selectedModifiers).map(([groupId, optionId]) => {
      const group = item.modifierGroups!.find((g) => g.id === groupId)!
      const option = group.options.find((o) => o.id === optionId)!
      return {
        groupId,
        optionId,
        labelVi: option.labelVi,
        labelEn: option.labelEn,
        priceDelta: option.priceDelta,
      }
    })
    addItem({
      menuItemId: item.id,
      nameVi: item.nameVi,
      nameEn: item.nameEn,
      size: size ? { id: size.id, label: size.label, priceDelta: size.priceDelta } : undefined,
      modifiers,
      unitPrice: priceFor(item, selectedSizeId, selectedModifiers),
    })
    setExpandedItemId(null)
  }

  function quickAdd(item: MenuItem) {
    if (!item.isAvailable) return
    if (item.sizes || item.modifierGroups) {
      openItem(item)
      return
    }
    addItem({
      menuItemId: item.id,
      nameVi: item.nameVi,
      nameEn: item.nameEn,
      modifiers: [],
      unitPrice: item.basePrice,
    })
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-32 pt-4 sm:px-6">
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-11 rounded-xl pl-9"
        />
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {menuCategories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setSelectedCategory(category.id)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              selectedCategory === category.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-accent/40"
            )}
          >
            {categoryLabel(category)}
          </button>
        ))}
      </div>

      {visibleItems.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">{t("emptyResults")}</p>
      )}

      <div className="flex flex-col gap-3">
        {visibleItems.map((item) => {
          const isExpanded = expandedItemId === item.id

          if (isExpanded) {
            return (
              <div
                key={item.id}
                className="overflow-hidden rounded-xl border bg-card shadow-md ring-1 ring-primary/10"
              >
                <ItemImagePlaceholder icon={item.icon} className="h-40 w-full" />
                <div className="flex flex-col gap-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-card-foreground">{name(item)}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{description(item)}</p>
                    </div>
                    <span className="whitespace-nowrap text-lg font-bold text-primary">
                      {formatVND(priceFor(item, selectedSizeId, selectedModifiers))}
                    </span>
                  </div>

                  {item.sizes && (
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t("size")}
                      </span>
                      <div className="flex gap-2">
                        {item.sizes.map((size) => (
                          <button
                            key={size.id}
                            type="button"
                            onClick={() => setSelectedSizeId(size.id)}
                            className={cn(
                              "flex-1 rounded-lg border-2 py-2 text-sm font-semibold transition-colors",
                              selectedSizeId === size.id
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-card-foreground hover:border-primary/50"
                            )}
                          >
                            {size.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {item.modifierGroups?.map((group) => (
                    <div key={group.id} className="flex flex-col gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {locale === "vi" ? group.labelVi : group.labelEn}
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {group.options.map((option) => {
                          const selected = selectedModifiers[group.id] === option.id
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() =>
                                setSelectedModifiers((prev) => ({ ...prev, [group.id]: option.id }))
                              }
                              className={cn(
                                "flex items-center justify-between rounded-lg border-2 px-3 py-2 text-sm transition-colors",
                                selected
                                  ? "border-primary bg-primary/10 font-semibold text-card-foreground"
                                  : "border-border text-card-foreground"
                              )}
                            >
                              <span>{locale === "vi" ? option.labelVi : option.labelEn}</span>
                              {selected && <Check className="h-4 w-4 text-primary" />}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}

                  <Button onClick={() => confirmAdd(item)} className="h-11 gap-2 rounded-xl text-base">
                    {t("confirm")}
                    <span className="opacity-80">•</span>
                    {formatVND(priceFor(item, selectedSizeId, selectedModifiers))}
                  </Button>
                </div>
              </div>
            )
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => openItem(item)}
              className={cn(
                "flex items-center gap-3 rounded-xl border bg-card p-2 text-left shadow-sm transition-shadow hover:shadow-md",
                !item.isAvailable && "opacity-70"
              )}
            >
              <ItemImagePlaceholder
                icon={item.icon}
                className={cn("h-20 w-20 shrink-0 rounded-lg", !item.isAvailable && "grayscale")}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="line-clamp-1 font-semibold text-card-foreground">{name(item)}</span>
                  {item.isPopular && (
                    <Badge className="shrink-0 bg-primary text-primary-foreground hover:bg-primary">
                      {t("popular")}
                    </Badge>
                  )}
                </div>
                <p className="line-clamp-1 text-xs text-muted-foreground">{description(item)}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-bold text-primary">{formatVND(item.basePrice)}</span>
                  {item.isAvailable ? (
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        quickAdd(item)
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform active:scale-90"
                    >
                      <Plus className="h-4 w-4" />
                    </span>
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Ban className="h-4 w-4" />
                    </span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {itemCount > 0 && (
        <Link
          href="/cart"
          className="fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-md items-center justify-between rounded-2xl bg-secondary px-5 py-4 text-secondary-foreground shadow-xl transition-colors hover:opacity-95"
        >
          <span className="font-semibold">
            {t("viewCart")} · {t("itemCount", { count: itemCount })}
          </span>
          <span className="text-lg font-bold">{formatVND(subtotal)}</span>
        </Link>
      )}
    </div>
  )
}
