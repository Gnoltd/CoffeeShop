"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { CreditCard, Banknote, QrCode, TableIcon, Sparkles } from "lucide-react"
import { Link, useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatVND } from "@/lib/format"
import { createClient } from "@/lib/supabase/client"
import { cancelPendingOrder } from "@/lib/supabase/orders-data"
import { useCart } from "@/hooks/useCart"
import { useTables } from "@/hooks/useTables"

/** Fallback shown only when Dine-in is picked manually without scanning a table's QR code first. */
const FALLBACK_TABLE_NUMBER = "04"

type OrderType = "pickup" | "dine-in"
type PaymentMethod = "stripe" | "cash" | "vnpay"

const PAYMENT_OPTIONS: { id: PaymentMethod; icon: typeof CreditCard; labelKey: "payStripe" | "payCash" | "payVNPay"; enabled: boolean }[] = [
  { id: "stripe", icon: CreditCard, labelKey: "payStripe", enabled: true },
  { id: "cash", icon: Banknote, labelKey: "payCash", enabled: true },
  { id: "vnpay", icon: QrCode, labelKey: "payVNPay", enabled: true },
]

export function CheckoutView() {
  const locale = useLocale()
  const t = useTranslations("Checkout")
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const { items, subtotal, promoCode, promoDiscount, clear } = useCart()
  const { activeTable } = useTables()

  const [orderType, setOrderType] = useState<OrderType>(activeTable ? "dine-in" : "pickup")
  const [pickupTime, setPickupTime] = useState("asap")
  const [redeemLoyalty, setRedeemLoyalty] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)
  const [payAt, setPayAt] = useState<"now" | "later">("now")
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [pointsBalance, setPointsBalance] = useState(0)
  const [redeemValuePerPoint, setRedeemValuePerPoint] = useState(0)
  const [isPlacing, setIsPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const [canceledNotice, setCanceledNotice] = useState(false)

  // One fixed redemption chunk per toggle-on, same UX as the old mock's
  // single "50 points for X đ" option — only the VND-per-point conversion
  // becomes real (loyalty_settings.redeem_value_vnd_per_point), not a
  // hardcoded 10,000đ.
  const REDEEM_CHUNK_POINTS = 50

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setIsLoggedIn(true)
      const { data: profile } = await supabase.from("profiles").select("loyalty_points_balance").eq("id", user.id).single()
      if (profile) setPointsBalance(profile.loyalty_points_balance)
    })
    supabase.from("loyalty_settings").select("redeem_value_vnd_per_point").eq("id", 1).single().then(({ data }) => {
      if (data) setRedeemValuePerPoint(data.redeem_value_vnd_per_point)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const canceledOrderId = searchParams.get("stripeCanceled")
    if (!canceledOrderId) return
    cancelPendingOrder(supabase, canceledOrderId).finally(() => {
      setCanceledNotice(true)
      router.replace("/checkout")
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (searchParams.get("paymentFailed") !== "1") return
    setCanceledNotice(true)
    router.replace("/checkout")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tableNumber = activeTable?.number ?? FALLBACK_TABLE_NUMBER
  const canRedeem = pointsBalance >= REDEEM_CHUNK_POINTS
  const loyaltyDiscount = redeemLoyalty && canRedeem ? REDEEM_CHUNK_POINTS * redeemValuePerPoint : 0
  const discount = promoDiscount + loyaltyDiscount
  const total = Math.max(subtotal - discount, 0)

  async function handlePlaceOrder() {
    if (items.length === 0 || (payAt === "now" && !paymentMethod)) return
    setError(null)
    setIsPlacing(true)
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("place-order", {
        body: {
          orderType: orderType === "dine-in" ? "dine_in" : "pickup",
          tableId: orderType === "dine-in" ? (activeTable?.id ?? null) : null,
          tableNumber: orderType === "dine-in" ? tableNumber : null,
          pickupTime: orderType === "pickup" ? pickupTime : null,
          paymentMethod: payAt === "now" ? paymentMethod : null,
          payAt,
          promoCode,
          redeemLoyaltyPoints: redeemLoyalty && canRedeem ? REDEEM_CHUNK_POINTS : 0,
          paymentCollected: false,
          locale,
          items: items.map((item) => ({
            menuItemId: item.menuItemId,
            sizeId: item.size?.id ?? null,
            modifierIds: item.modifiers.map((m) => m.optionId),
            quantity: item.quantity,
            note: item.note ?? null,
          })),
        },
      })
      if (invokeError || data?.error) throw invokeError ?? new Error(data.error)
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
        return
      }
      clear()
      if (orderType === "dine-in") {
        router.push(`/orders/${data.orderId}?table=${encodeURIComponent(tableNumber)}`)
      } else {
        router.push(`/orders/${data.orderId}`)
      }
    } catch {
      setError(paymentMethod === "stripe" ? t("cardPaymentUnavailable") : t("placeOrderError"))
      setIsPlacing(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-24 text-center">
        <p className="text-muted-foreground">{t("emptyCart")}</p>
        <Button className="h-11" render={<Link href="/menu" />} nativeButton={false}>
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
            {t("table")}: <strong>{tableNumber}</strong>
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
                  {item.note && (
                    <p className="text-xs italic text-muted-foreground">
                      {t("noteLabel")}: {item.note}
                    </p>
                  )}
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
        {promoDiscount > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("discount")}</span>
            <span className="font-bold text-green-600">-{formatVND(promoDiscount)}</span>
          </div>
        )}
      </section>

      <section className="mb-6 space-y-3 rounded-xl border border-accent/30 bg-accent/10 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-card-foreground">{t("loyaltyPoints")}</h2>
          <Sparkles className="h-6 w-6 text-accent-foreground/70" />
        </div>
        {isLoggedIn ? (
          <>
            <p className="text-sm text-muted-foreground">{t("pointsBalance", { points: pointsBalance })}</p>
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
              <span className="text-sm font-medium text-card-foreground">
                {t("redeemLabel", { points: REDEEM_CHUNK_POINTS, amount: formatVND(REDEEM_CHUNK_POINTS * redeemValuePerPoint) })}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={redeemLoyalty}
                disabled={!canRedeem}
                onClick={() => setRedeemLoyalty((prev) => !prev)}
                className={cn(
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40",
                  redeemLoyalty ? "bg-primary" : "bg-muted-foreground/30"
                )}
              >
                <span
                  className={cn(
                    "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                    redeemLoyalty ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground" title={t("loyaltyGuestTooltip")}>
            {t("loyaltyGuestTooltip")}
          </p>
        )}
      </section>

      <section className="mb-6 space-y-2">
        <h2 className="font-bold text-card-foreground">{t("payTiming")}</h2>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setPayAt("now")}
            className={cn(
              "flex-1 rounded-md py-3 text-sm font-bold transition-all",
              payAt === "now" ? "bg-card text-card-foreground shadow-sm" : "text-muted-foreground"
            )}
          >
            {t("payNow")}
          </button>
          <button
            type="button"
            onClick={() => setPayAt("later")}
            className={cn(
              "flex-1 rounded-md py-3 text-sm font-bold transition-all",
              payAt === "later" ? "bg-card text-card-foreground shadow-sm" : "text-muted-foreground"
            )}
          >
            {t("payLater")}
          </button>
        </div>
        {payAt === "later" && <p className="text-sm text-muted-foreground">{t("payLaterNote")}</p>}
      </section>

      {payAt === "now" && (
        <section className="mb-6 space-y-2">
          <h2 className="font-bold text-card-foreground">{t("paymentMethod")}</h2>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_OPTIONS.map(({ id, icon: Icon, labelKey, enabled }) => (
              <button
                key={id}
                type="button"
                disabled={!enabled}
                title={enabled ? undefined : t("paymentMethodComingSoon")}
                onClick={() => setPaymentMethod(id)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors",
                  paymentMethod === id
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-transparent bg-muted text-muted-foreground",
                  !enabled && "opacity-50"
                )}
              >
                <Icon className="h-7 w-7" />
                <span className="text-xs font-bold">{t(labelKey)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {canceledNotice && (
        <p className="mx-auto mb-2 max-w-2xl rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          {t("paymentCanceledNotice")}
        </p>
      )}
      {error && (
        <p className="mx-auto mb-2 max-w-2xl rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}
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
          disabled={(payAt === "now" && !paymentMethod) || isPlacing}
          className="h-12 rounded-xl px-8 text-base font-bold"
        >
          {t("placeOrder")}
        </Button>
      </div>
    </div>
  )
}
