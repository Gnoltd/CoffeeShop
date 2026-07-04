"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { CreditCard, Banknote, QrCode, TableIcon, Sparkles } from "lucide-react"
import { Link, useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatVND } from "@/lib/format"
import { useCart } from "@/hooks/useCart"

/**
 * Loyalty numbers are mocked (no loyalty_settings table yet — see
 * docs/superpowers/plans/2026-07-04-coffee-shop-scaffold.md Task 4). Real
 * defaults agreed for the DB: 10,000 VND spent = 1 point earned,
 * 100 points = 10,000 VND redeemed. The redeem option shown here (50
 * points for 10,000đ) matches the approved Stitch mockup's example values.
 */
const MOCK_POINTS_BALANCE = 150
const MOCK_REDEEM_POINTS = 50
const MOCK_REDEEM_AMOUNT = 10000
const MOCK_TABLE_NUMBER = "04"

type OrderType = "pickup" | "dine-in"
type PaymentMethod = "stripe" | "cash" | "vnpay"

const PAYMENT_OPTIONS: { id: PaymentMethod; icon: typeof CreditCard; labelKey: "payStripe" | "payCash" }[] = [
  { id: "stripe", icon: CreditCard, labelKey: "payStripe" },
  { id: "cash", icon: Banknote, labelKey: "payCash" },
]

export function CheckoutView() {
  const locale = useLocale()
  const t = useTranslations("Checkout")
  const router = useRouter()
  const { items, subtotal, clear } = useCart()

  const [orderType, setOrderType] = useState<OrderType>("pickup")
  const [pickupTime, setPickupTime] = useState("asap")
  const [redeemLoyalty, setRedeemLoyalty] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)

  const discount = redeemLoyalty ? MOCK_REDEEM_AMOUNT : 0
  const total = Math.max(subtotal - discount, 0)

  function handlePlaceOrder() {
    if (items.length === 0 || !paymentMethod) return
    const mockOrderId = `PDC-${Math.floor(1000 + Math.random() * 9000)}`
    clear()
    router.push(`/orders/${mockOrderId}`)
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-24 text-center">
        <p className="text-muted-foreground">{t("emptyCart")}</p>
        <Button className="h-11" render={<Link href="/menu" />}>
          {t("browseMenu")}
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-32 pt-4 sm:px-6">
      <section className="mb-6 space-y-2">
        <h2 className="font-bold text-card-foreground">{t("orderType")}</h2>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setOrderType("pickup")}
            className={cn(
              "flex-1 rounded-md py-3 text-sm font-bold transition-all",
              orderType === "pickup"
                ? "bg-card text-card-foreground shadow-sm"
                : "text-muted-foreground"
            )}
          >
            {t("pickup")}
          </button>
          <button
            type="button"
            onClick={() => setOrderType("dine-in")}
            className={cn(
              "flex-1 rounded-md py-3 text-sm font-bold transition-all",
              orderType === "dine-in"
                ? "bg-card text-card-foreground shadow-sm"
                : "text-muted-foreground"
            )}
          >
            {t("dineIn")}
          </button>
        </div>
        {orderType === "dine-in" && (
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/20 px-3 py-1.5 text-sm text-accent-foreground">
            <TableIcon className="h-4 w-4" />
            {t("table")}: <strong>{MOCK_TABLE_NUMBER}</strong>
          </div>
        )}
      </section>

      {orderType === "pickup" && (
        <section className="mb-6 space-y-2">
          <label htmlFor="pickup-time" className="block font-bold text-card-foreground">
            {t("pickupTime")}
          </label>
          <select
            id="pickup-time"
            value={pickupTime}
            onChange={(e) => setPickupTime(e.target.value)}
            className="h-14 w-full rounded-xl border border-input bg-card px-4 text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="asap">{t("asap")}</option>
            <option value="15">{t("in15")}</option>
            <option value="30">{t("in30")}</option>
            <option value="schedule">{t("schedule")}</option>
          </select>
        </section>
      )}

      <section className="mb-6 space-y-3 rounded-xl border bg-muted p-4">
        <h2 className="font-bold text-card-foreground">{t("summary")}</h2>
        <div className="space-y-3">
          {items.map((item) => {
            const name = locale === "vi" ? item.nameVi : item.nameEn
            return (
              <div key={item.cartItemId} className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-card-foreground">{name}</p>
                  <p className="text-xs text-muted-foreground">x{item.quantity}</p>
                </div>
                <span className="text-sm font-bold text-card-foreground">
                  {formatVND(item.unitPrice * item.quantity)}
                </span>
              </div>
            )
          })}
        </div>
        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-sm text-muted-foreground">{t("subtotal")}</span>
          <span className="font-bold text-card-foreground">{formatVND(subtotal)}</span>
        </div>
      </section>

      <section className="mb-6 space-y-3 rounded-xl border border-accent/30 bg-accent/10 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-card-foreground">{t("loyaltyPoints")}</h2>
          <Sparkles className="h-6 w-6 text-accent-foreground/70" />
        </div>
        <p className="text-sm text-muted-foreground">{t("pointsBalance", { points: MOCK_POINTS_BALANCE })}</p>
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
          <span className="text-sm font-medium text-card-foreground">
            {t("redeemLabel", { points: MOCK_REDEEM_POINTS, amount: formatVND(MOCK_REDEEM_AMOUNT) })}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={redeemLoyalty}
            onClick={() => setRedeemLoyalty((prev) => !prev)}
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition-colors",
              redeemLoyalty ? "bg-primary" : "bg-muted-foreground/30"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                redeemLoyalty ? "translate-x-[22px]" : "translate-x-0.5"
              )}
            />
          </button>
        </div>
      </section>

      <section className="mb-6 space-y-2">
        <h2 className="font-bold text-card-foreground">{t("paymentMethod")}</h2>
        <div className="grid grid-cols-3 gap-2">
          {PAYMENT_OPTIONS.map(({ id, icon: Icon, labelKey }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPaymentMethod(id)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors",
                paymentMethod === id
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-transparent bg-muted text-muted-foreground"
              )}
            >
              <Icon className="h-7 w-7" />
              <span className="text-xs font-bold">{t(labelKey)}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPaymentMethod("vnpay")}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors",
              paymentMethod === "vnpay"
                ? "border-primary bg-primary/5 text-primary"
                : "border-transparent bg-muted text-muted-foreground"
            )}
          >
            <QrCode className="h-7 w-7" />
            <span className="text-xs font-bold">VNPay</span>
          </button>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between border-t bg-card px-6 py-4 shadow-[0_-4px_12px_-1px_rgba(0,0,0,0.1)]">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">{t("total")}</span>
          <span className="text-xl font-bold text-primary">{formatVND(total)}</span>
          {redeemLoyalty && (
            <span className="text-[11px] text-accent-foreground/80">
              {t("discountApplied", { amount: formatVND(discount) })}
            </span>
          )}
        </div>
        <Button
          onClick={handlePlaceOrder}
          disabled={!paymentMethod}
          className="h-12 rounded-xl px-8 text-base font-bold"
        >
          {t("placeOrder")}
        </Button>
      </div>
    </div>
  )
}
