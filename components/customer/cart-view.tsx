"use client"

import { useLocale, useTranslations } from "next-intl"
import { Minus, Plus, Trash2, ArrowRight, ShoppingBasket } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { formatVND } from "@/lib/format"
import { useCart, type CartItem } from "@/hooks/useCart"

function lineLabel(item: CartItem, locale: string): string {
  const parts: string[] = []
  if (item.size) parts.push(item.size.label)
  item.modifiers.forEach((m) => parts.push(locale === "vi" ? m.labelVi : m.labelEn))
  return parts.join(", ")
}

export function CartView() {
  const locale = useLocale()
  const t = useTranslations("Cart")
  const { items, updateQuantity, removeItem, subtotal } = useCart()

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-24 text-center">
        <ShoppingBasket className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">{t("empty")}</p>
        <Button className="h-11" render={<Link href="/menu" />}>
          {t("browseMenu")}
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const name = locale === "vi" ? item.nameVi : item.nameEn
          const label = lineLabel(item, locale)
          return (
            <div
              key={item.cartItemId}
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
                      onClick={() => removeItem(item.cartItemId)}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                      aria-label={t("remove")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {label && <p className="mt-1 text-xs text-muted-foreground">{label}</p>}
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
                      onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-background"
                      aria-label={t("decrease")}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-background"
                      aria-label={t("increase")}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <section className="mt-6 space-y-3 rounded-2xl bg-muted p-5">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("subtotal")}</span>
          <span className="font-medium">{formatVND(subtotal)}</span>
        </div>
        <div className="h-px bg-border" />
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-card-foreground">{t("total")}</span>
          <span className="text-lg font-bold text-primary">{formatVND(subtotal)}</span>
        </div>
      </section>

      <Button
        className="mt-6 h-12 w-full gap-2 rounded-xl text-base"
        render={<Link href="/checkout" />}
      >
        {t("proceedToCheckout")}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
