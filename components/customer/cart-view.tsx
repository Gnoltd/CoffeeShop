"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { motion, useMotionValue, type PanInfo } from "framer-motion"
import { Minus, Plus, Trash2, ArrowRight, ShoppingBasket, Ticket, X } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatVND } from "@/lib/format"
import { useCart, type CartItem } from "@/hooks/useCart"
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list"
import { AnimatedCounter } from "@/components/motion/animated-counter"

function lineLabel(item: CartItem, locale: string): string {
  const parts: string[] = []
  if (item.size) parts.push(item.size.label)
  item.modifiers.forEach((m) => parts.push(locale === "vi" ? m.labelVi : m.labelEn))
  return parts.join(", ")
}

const SWIPE_DISMISS_THRESHOLD = -80

function CartRow({
  item,
  locale,
  t,
  onRemove,
  onUpdateQuantity,
}: {
  item: CartItem
  locale: string
  t: ReturnType<typeof useTranslations>
  onRemove: (id: string) => void
  onUpdateQuantity: (id: string, quantity: number) => void
}) {
  const x = useMotionValue(0)
  const name = locale === "vi" ? item.nameVi : item.nameEn
  const label = lineLabel(item, locale)

  function handleDragEnd(_event: unknown, info: PanInfo) {
    if (info.offset.x < SWIPE_DISMISS_THRESHOLD) onRemove(item.cartItemId)
  }

  return (
    <motion.div
      style={{ x }}
      drag="x"
      dragConstraints={{ left: -96, right: 0 }}
      dragElastic={{ left: 0.15, right: 0 }}
      onDragEnd={handleDragEnd}
      className="flex gap-3 rounded-xl border bg-card p-3 shadow-sm"
    >
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-muted">
        <ShoppingBasket className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="flex flex-1 flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold leading-tight text-card-foreground">{name}</h3>
            <button
              type="button"
              onClick={() => onRemove(item.cartItemId)}
              className="text-muted-foreground transition-colors hover:text-destructive"
              aria-label={t("remove")}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          {label && <p className="mt-1 text-xs text-muted-foreground">{label}</p>}
          {item.note && (
            <p className="mt-1 text-xs italic text-muted-foreground">
              {t("noteLabel")}: {item.note}
            </p>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-bold text-primary">
              {formatVND(item.unitPrice * item.quantity)}
            </span>
            {item.quantity > 1 && (
              <span className="text-[10px] text-muted-foreground">
                {formatVND(item.unitPrice)} × {item.quantity}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 rounded-full bg-muted px-1 py-1">
            <button
              type="button"
              onClick={() => onUpdateQuantity(item.cartItemId, item.quantity - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-background"
              aria-label={t("decrease")}
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
            <button
              type="button"
              onClick={() => onUpdateQuantity(item.cartItemId, item.quantity + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-background"
              aria-label={t("increase")}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export function CartView() {
  const locale = useLocale()
  const t = useTranslations("Cart")
  const { items, updateQuantity, removeItem, subtotal, promoCode, promoDiscount, applyPromoCode, clearPromoCode } =
    useCart()
  const [promoInput, setPromoInput] = useState("")
  const [promoError, setPromoError] = useState(false)

  function handleApplyPromo() {
    const success = applyPromoCode(promoInput)
    setPromoError(!success)
    if (success) setPromoInput("")
  }

  const total = Math.max(subtotal - promoDiscount, 0)

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-24 text-center">
        <ShoppingBasket className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">{t("empty")}</p>
        <Button className="h-11" render={<Link href="/menu" />} nativeButton={false}>
          {t("browseMenu")}
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-4 sm:px-6">
      <StaggerList className="flex flex-col gap-3">
        {items.map((item) => (
          <StaggerItem key={item.cartItemId}>
            <CartRow item={item} locale={locale} t={t} onRemove={removeItem} onUpdateQuantity={updateQuantity} />
          </StaggerItem>
        ))}
      </StaggerList>

      {promoCode ? (
        <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium text-accent-foreground">
            <Ticket className="h-4 w-4" />
            {t("promoApplied")}: <strong>{promoCode}</strong>
          </span>
          <button
            type="button"
            onClick={clearPromoCode}
            aria-label={t("removePromo")}
            title={t("removePromo")}
            className="text-accent-foreground/70 hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-2 rounded-xl border border-dashed p-4">
          <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Ticket className="h-4 w-4" />
            {t("promoLabel")}
          </span>
          <div className="flex gap-2">
            <Input
              value={promoInput}
              onChange={(e) => {
                setPromoInput(e.target.value)
                setPromoError(false)
              }}
              placeholder={t("promoPlaceholder")}
              className="h-10 flex-1"
            />
            <Button variant="outline" className="h-10" onClick={handleApplyPromo} disabled={!promoInput.trim()}>
              {t("apply")}
            </Button>
          </div>
          {promoError && <p className="text-xs text-destructive">{t("invalidPromo")}</p>}
        </div>
      )}

      <section className="mt-6 space-y-3 rounded-2xl bg-muted p-5">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("subtotal")}</span>
          <AnimatedCounter value={subtotal} format={formatVND} className="font-medium" />
        </div>
        {promoDiscount > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("discount")}</span>
            <span className="font-medium text-green-600">-{formatVND(promoDiscount)}</span>
          </div>
        )}
        <div className="h-px bg-border" />
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-card-foreground">{t("total")}</span>
          <AnimatedCounter value={total} format={formatVND} className="text-lg font-bold text-primary" />
        </div>
      </section>

      <Button
        className="mt-6 h-12 w-full gap-2 rounded-xl text-base"
        render={<Link href="/checkout" />}
        nativeButton={false}
      >
        {t("proceedToCheckout")}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
