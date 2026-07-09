"use client"

import { useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Coffee, CupSoda, Cookie, Milk, Search, Plus, Ban } from "lucide-react"
import { Link, useRouter } from "@/i18n/navigation"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatVND } from "@/lib/format"
import { useCart } from "@/hooks/useCart"
import { QuickAddPopup } from "@/components/customer/quick-add-popup"
import { SegmentedControl } from "@/components/motion/segmented-control"
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list"
import { TAP_SCALE, TAP_TRANSITION } from "@/components/motion/press-feedback"
import type { MenuCategory, MenuIcon, MenuItem } from "@/lib/supabase/menu-data"

const ALL_CATEGORY = "all"

const ICONS: Record<MenuIcon, typeof Coffee> = {
  coffee: Coffee,
  "cup-soda": CupSoda,
  cookie: Cookie,
  milk: Milk,
}

function ItemImage({ item, className }: { item: MenuItem; className?: string }) {
  if (item.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.imageUrl} alt="" className={cn("object-cover", className)} />
  }
  const Icon = ICONS[item.icon]
  return (
    <div className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}>
      <Icon className="h-8 w-8" />
    </div>
  )
}

export function MenuBrowser({ categories, items }: { categories: MenuCategory[]; items: MenuItem[] }) {
  const locale = useLocale()
  const t = useTranslations("Menu")
  const router = useRouter()
  const { addItem, itemCount, subtotal } = useCart()

  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORY)
  const [searchQuery, setSearchQuery] = useState("")
  const [quickAddItem, setQuickAddItem] = useState<MenuItem | null>(null)

  const name = (item: MenuItem) => (locale === "vi" ? item.nameVi : item.nameEn)
  const description = (item: MenuItem) => (locale === "vi" ? item.descriptionVi : item.descriptionEn)
  const categoryLabel = (c: MenuCategory) => (locale === "vi" ? c.nameVi : c.nameEn)

  const visibleItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return items.filter((item) => {
      const matchesCategory = selectedCategory === ALL_CATEGORY || item.categoryId === selectedCategory
      const matchesQuery =
        query === "" ||
        item.nameVi.toLowerCase().includes(query) ||
        item.nameEn.toLowerCase().includes(query)
      return matchesCategory && matchesQuery
    })
  }, [items, selectedCategory, searchQuery])

  function openItem(item: MenuItem) {
    if (!item.isAvailable) return
    router.push(`/menu/${item.id}`)
  }

  function quickAdd(item: MenuItem) {
    if (!item.isAvailable) return
    const needsChoice = (item.hasSizeOptions && item.sizes.length > 0) || item.modifierGroups.length > 0
    if (needsChoice) {
      setQuickAddItem(item)
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

      <SegmentedControl
        variant="chips"
        layoutId="menu-category-pill"
        className="mb-6"
        value={selectedCategory}
        onChange={setSelectedCategory}
        options={[
          { value: ALL_CATEGORY, label: t("allCategories") },
          ...categories.map((category) => ({ value: category.id, label: categoryLabel(category) })),
        ]}
      />

      {visibleItems.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">{t("emptyResults")}</p>
      )}

      <StaggerList staggerKey={selectedCategory + searchQuery} className="flex flex-col gap-3">
        {visibleItems.map((item) => (
          <StaggerItem key={item.id}>
            <button
              type="button"
              onClick={() => openItem(item)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border bg-card p-2 text-left shadow-sm transition-shadow hover:shadow-md",
                !item.isAvailable && "opacity-70"
              )}
            >
              <ItemImage
                item={item}
                className={cn("h-28 w-28 shrink-0 rounded-lg", !item.isAvailable && "grayscale")}
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
                    <motion.span
                      role="button"
                      whileTap={TAP_SCALE}
                      transition={TAP_TRANSITION}
                      onClick={(e) => {
                        e.stopPropagation()
                        quickAdd(item)
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm"
                    >
                      <Plus className="h-4 w-4" />
                    </motion.span>
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Ban className="h-4 w-4" />
                    </span>
                  )}
                </div>
              </div>
            </button>
          </StaggerItem>
        ))}
      </StaggerList>

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

      {quickAddItem && (
        <QuickAddPopup item={quickAddItem} onClose={() => setQuickAddItem(null)} />
      )}
    </div>
  )
}
