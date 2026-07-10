"use client"

import { useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Coffee, CupSoda, Cookie, Milk, Check } from "lucide-react"
import { useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatVND } from "@/lib/format"
import { useCart, type CartModifier } from "@/hooks/useCart"
import { StarRating } from "@/components/customer/star-rating"
import { createClient } from "@/lib/supabase/client"
import { getMenuItemReviews, type MenuItemReview } from "@/lib/supabase/reviews-data"
import { SegmentedControl } from "@/components/motion/segmented-control"
import { PressFeedback, TAP_SCALE, TAP_TRANSITION } from "@/components/motion/press-feedback"
import type { MenuItem, MenuIcon } from "@/lib/supabase/menu-data"

const ICONS: Record<MenuIcon, typeof Coffee> = {
  coffee: Coffee,
  "cup-soda": CupSoda,
  cookie: Cookie,
  milk: Milk,
}

export function ProductDetail({ item }: { item: MenuItem }) {
  const locale = useLocale()
  const t = useTranslations("Menu")
  const tProduct = useTranslations("ProductDetail")
  const router = useRouter()
  const { addItem } = useCart()
  const [supabase] = useState(() => createClient())
  const [reviews, setReviews] = useState<MenuItemReview[]>([])
  const [avgRating, setAvgRating] = useState(0)
  const [reviewCount, setReviewCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    getMenuItemReviews(supabase, item.id).then((result) => {
      if (cancelled) return
      setReviews(result.reviews)
      setAvgRating(result.avgRating)
      setReviewCount(result.reviewCount)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(
    item.hasSizeOptions ? item.sizes?.find((s) => s.priceDelta === 0)?.id ?? item.sizes?.[0]?.id ?? null : null
  )
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {}
    item.modifierGroups?.forEach((group) => {
      if (group.required) defaults[group.id] = group.options[0].id
    })
    return defaults
  })
  const [note, setNote] = useState("")

  const name = locale === "vi" ? item.nameVi : item.nameEn
  const description = locale === "vi" ? item.descriptionVi : item.descriptionEn
  const Icon = ICONS[item.icon]

  const sizeDelta = item.sizes?.find((s) => s.id === selectedSizeId)?.priceDelta ?? 0
  const modifierDelta = Object.entries(selectedModifiers).reduce((sum, [groupId, optionId]) => {
    const group = item.modifierGroups?.find((g) => g.id === groupId)
    const option = group?.options.find((o) => o.id === optionId)
    return sum + (option?.priceDelta ?? 0)
  }, 0)
  const price = item.basePrice + sizeDelta + modifierDelta
  const extraGroups = item.modifierGroups?.filter((g) => g.options.length === 1) ?? []
  const otherGroups = item.modifierGroups?.filter((g) => g.options.length > 1) ?? []

  function handleAddToCart() {
    const size = item.sizes?.find((s) => s.id === selectedSizeId)
    const modifiers: CartModifier[] = Object.entries(selectedModifiers).map(([groupId, optionId]) => {
      const group = item.modifierGroups!.find((g) => g.id === groupId)!
      const option = group.options.find((o) => o.id === optionId)!
      return {
        groupId,
        optionId,
        labelVi: option.nameVi,
        labelEn: option.nameEn,
        priceDelta: option.priceDelta,
      }
    })
    const trimmedNote = note.trim()
    addItem({
      menuItemId: item.id,
      nameVi: item.nameVi,
      nameEn: item.nameEn,
      size: size ? { id: size.id, label: size.name, priceDelta: size.priceDelta } : undefined,
      modifiers,
      note: trimmedNote || undefined,
      unitPrice: price,
    })
    router.push("/menu")
  }

  return (
    <div className="mx-auto w-full max-w-2xl pb-28">
      <div className="flex h-64 w-full items-center justify-center bg-muted text-muted-foreground sm:h-80">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <Icon className="h-20 w-20" />
        )}
      </div>

      <div className="px-4 pt-4 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-card-foreground">{name}</h1>
          <span className="whitespace-nowrap text-xl font-bold text-primary">{formatVND(price)}</span>
        </div>

        {reviewCount > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <StarRating rating={avgRating} />
            <span className="text-sm text-muted-foreground">
              {avgRating.toFixed(1)} · {tProduct("reviewCount", { count: reviewCount })}
            </span>
          </div>
        )}

        <p className="mt-3 text-sm text-muted-foreground">{description}</p>

        {item.hasSizeOptions && item.sizes.length > 0 && (
          <section className="mt-6 flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("size")}
            </span>
            <SegmentedControl
              variant="tabs"
              layoutId="product-size-pill"
              value={selectedSizeId ?? ""}
              onChange={setSelectedSizeId}
              options={item.sizes.map((size) => ({ value: size.id, label: size.name }))}
            />
          </section>
        )}

        {extraGroups.length > 0 && (
          <section className="mt-6 flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {tProduct("extrasLabel")}
            </span>
            <div className="flex flex-col gap-2">
              {extraGroups.map((group) => {
                const option = group.options[0]
                const selected = selectedModifiers[group.id] === option.id
                return (
                  <PressFeedback
                    key={group.id}
                    type="button"
                    onClick={() =>
                      setSelectedModifiers((prev) => {
                        if (prev[group.id] === option.id) {
                          const next = { ...prev }
                          delete next[group.id]
                          return next
                        }
                        return { ...prev, [group.id]: option.id }
                      })
                    }
                    className={cn(
                      "flex items-center justify-between rounded-lg border-2 px-3 py-2 text-sm transition-colors",
                      selected
                        ? "border-primary bg-primary/10 font-semibold text-card-foreground"
                        : "border-border text-card-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Check className={cn("h-4 w-4 shrink-0", selected ? "text-primary" : "text-transparent")} />
                      <span>{locale === "vi" ? option.nameVi : option.nameEn}</span>
                    </div>
                    <span className={selected ? "text-primary" : "text-muted-foreground"}>
                      {option.priceDelta > 0 ? `+${formatVND(option.priceDelta)}` : tProduct("freeLabel")}
                    </span>
                  </PressFeedback>
                )
              })}
            </div>
          </section>
        )}

        {otherGroups.map((group) => (
          <section key={group.id} className="mt-6 flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {locale === "vi" ? group.nameVi : group.nameEn}
            </span>
            <div className="grid grid-cols-2 gap-2">
              {group.options.map((option) => {
                const selected = selectedModifiers[group.id] === option.id
                return (
                  <PressFeedback
                    key={option.id}
                    type="button"
                    onClick={() =>
                      setSelectedModifiers((prev) => {
                        if (!group.required && prev[group.id] === option.id) {
                          const next = { ...prev }
                          delete next[group.id]
                          return next
                        }
                        return { ...prev, [group.id]: option.id }
                      })
                    }
                    className={cn(
                      "flex flex-col items-start gap-0.5 rounded-lg border-2 px-3 py-2 text-sm transition-colors",
                      selected
                        ? "border-primary bg-primary/10 font-semibold text-card-foreground"
                        : "border-border text-card-foreground"
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span>{locale === "vi" ? option.nameVi : option.nameEn}</span>
                      {selected && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {option.priceDelta > 0 ? `+${formatVND(option.priceDelta)}` : tProduct("freeLabel")}
                    </span>
                  </PressFeedback>
                )
              })}
            </div>
          </section>
        ))}

        <section className="mt-6 flex flex-col gap-2">
          <label
            htmlFor="product-note"
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {t("noteLabel")}
          </label>
          <textarea
            id="product-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("notePlaceholder")}
            rows={2}
            className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </section>

        <section className="mt-8 border-t pt-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-card-foreground">{tProduct("reviewsTitle")}</h2>
            {reviewCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-primary">{avgRating.toFixed(1)}</span>
                <StarRating rating={avgRating} size="lg" />
              </div>
            )}
          </div>
          {reviewCount === 0 ? (
            <p className="text-sm text-muted-foreground">{tProduct("noReviewsYet")}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {reviews.map((review) => (
                <div key={review.id} className="rounded-xl border bg-card p-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
                      {(review.reviewerName ?? tProduct("anonymousReviewer")).charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-card-foreground">
                          {review.reviewerName ?? tProduct("anonymousReviewer")}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {tProduct("daysAgo", {
                            days: Math.max(0, Math.floor((Date.now() - review.createdAt) / 86400000)),
                          })}
                        </span>
                      </div>
                      <StarRating rating={review.rating} />
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-card-foreground">{review.comment}</p>
                  {review.staffReply && (
                    <div className="ml-12 mt-2 rounded-lg bg-muted p-2">
                      <p className="text-xs font-semibold text-secondary">{tProduct("shopReplyLabel")}</p>
                      <p className="text-sm text-card-foreground">{review.staffReply}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between border-t bg-card px-6 py-4 shadow-[0_-4px_12px_-1px_rgba(0,0,0,0.1)]"
      >
        <span className="text-xl font-bold text-primary">{formatVND(price)}</span>
        <motion.div whileTap={item.isAvailable ? TAP_SCALE : undefined} transition={TAP_TRANSITION}>
          <Button
            onClick={handleAddToCart}
            disabled={!item.isAvailable}
            className="h-12 gap-2 rounded-xl px-8 text-base font-bold"
          >
            {tProduct("addToCart")}
          </Button>
        </motion.div>
      </motion.div>
    </div>
  )
}
