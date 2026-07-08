"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  CookingPot, Check, PackageCheck, CircleCheckBig, Clock, TableIcon, ShoppingBag, Store, Phone, Utensils,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { formatOrderId, formatVND } from "@/lib/format"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { payExistingOrder } from "@/lib/supabase/orders-data"
import { useOrders, type OrderForTracking, type OrderStatus } from "@/hooks/useOrders"

const MOCK_SHOP_PHONE = "+84281234567"
const GUEST_POLL_INTERVAL_MS = 10000

const STEPS = [
  { key: "stepPaid", icon: Check },
  { key: "stepPreparing", icon: CookingPot },
  { key: "stepReady", icon: PackageCheck },
  { key: "stepServed", icon: Utensils },
  { key: "stepCompleted", icon: CircleCheckBig },
] as const

const STATUS_STEP: Record<OrderStatus, number> = {
  pending_payment: -1,
  paid: 0,
  preparing: 1,
  ready: 2,
  served: 3,
  completed: 4,
  cancelled: -1,
}

const STATUS_LABEL_KEY: Record<OrderStatus, string> = {
  pending_payment: "statusPendingPayment",
  paid: "statusPaid",
  preparing: "statusPreparing",
  ready: "statusReady",
  served: "statusServed",
  completed: "statusCompleted",
  cancelled: "statusCancelled",
}

export function OrderTracking({ orderId, table }: { orderId: string; table?: string }) {
  const locale = useLocale()
  const t = useTranslations("OrderTracking")
  const { getOrder } = useOrders()
  const [supabase] = useState(() => createClient())

  const [order, setOrder] = useState<OrderForTracking | null | undefined>(undefined)
  const [isGuestPolling, setIsGuestPolling] = useState(false)
  const [isPaying, setIsPaying] = useState(false)
  const [paymentNotice, setPaymentNotice] = useState(false)
  const searchParams = useSearchParams()

  useEffect(() => {
    const failed = searchParams.get("paymentFailed") === "1" || searchParams.get("stripeCanceled") === "1"
    if (failed) setPaymentNotice(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handlePayNow() {
    setIsPaying(true)
    try {
      const { checkoutUrl } = await payExistingOrder(supabase, orderId, locale)
      window.location.href = checkoutUrl
    } catch {
      setPaymentNotice(true)
      setIsPaying(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    let pollInterval: ReturnType<typeof setInterval> | undefined
    let channel: ReturnType<typeof supabase.channel> | undefined

    async function load() {
      const found = await getOrder(orderId)
      if (cancelled) return
      setOrder(found)
      if (!found) return

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // No session at all — this can only be a guest's own order (the
        // RPC already refused anything else). Realtime's authorization
        // is gated by the same RLS a direct SELECT would need, which a
        // guest never satisfies, so there is no live-push option here —
        // poll instead.
        setIsGuestPolling(true)
        pollInterval = setInterval(async () => {
          const refreshed = await getOrder(orderId)
          if (!cancelled) setOrder(refreshed)
        }, GUEST_POLL_INTERVAL_MS)
        return
      }

      // Logged-in customer (own order, matches orders_select_own) or
      // staff (matches orders_select_staff) — both are genuinely visible
      // to Realtime under existing RLS, so subscribe for real. No
      // server-side `filter` here — found live that Supabase Realtime's
      // column filters don't reliably combine with RLS-gated
      // postgres_changes (a filtered subscription silently received
      // nothing, while the identical subscription with no filter
      // delivered events correctly). Filtering to this one order id is
      // done client-side instead, on the delivered payload.
      channel = supabase
        .channel(`order-tracking-${orderId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "orders" },
          async (payload) => {
            if ((payload.new as { id?: string })?.id !== orderId) return
            const refreshed = await getOrder(orderId)
            if (!cancelled) setOrder(refreshed)
          }
        )
        .subscribe((status) => {
          if (status !== "SUBSCRIBED" && status !== "CLOSED") {
            console.warn(`Order tracking realtime subscription status: ${status}`)
          }
        })
    }
    load()

    return () => {
      cancelled = true
      if (pollInterval) clearInterval(pollInterval)
      if (channel) supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  if (order === undefined) return null

  if (order === null) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-lg font-bold text-card-foreground">{t("notFoundTitle")}</p>
        <p className="text-sm text-muted-foreground">{t("notFoundMessage")}</p>
      </div>
    )
  }

  const currentStep = STATUS_STEP[order.status]
  const progressPercent = currentStep < 0 ? 0 : (currentStep / (STEPS.length - 1)) * 100

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4 sm:px-6">
      <section className="relative overflow-hidden rounded-xl border bg-muted p-6 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-secondary">{t("orderId")}</p>
        <h2 className="mb-4 text-3xl font-bold text-primary">#{formatOrderId(order.id)}</h2>
        <div className="mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-primary/15">
          <CookingPot className="h-12 w-12 text-primary" />
        </div>
        <h3 className="mb-1 text-xl font-semibold text-card-foreground">{t(STATUS_LABEL_KEY[order.status])}</h3>
        {order.status === "preparing" && (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 text-primary" />
            {t("etaLabel")}
          </p>
        )}
        {isGuestPolling && <p className="mt-2 text-[11px] text-muted-foreground">{t("guestPollingNote")}</p>}
      </section>

      <section className="mt-8 px-2">
        <div className="relative flex items-start justify-between">
          <div className="absolute top-5 left-0 h-1 w-full -z-0 bg-border" />
          <div
            className="absolute top-5 left-0 -z-0 h-1 bg-primary transition-all duration-1000"
            style={{ width: `${progressPercent}%` }}
          />
          {STEPS.map((step, index) => {
            const Icon = step.icon
            const isDone = index <= currentStep
            return (
              <div key={step.key} className="z-10 flex w-1/4 flex-col items-center gap-2">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full shadow-sm",
                    isDone ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <p
                  className={cn(
                    "text-center text-[10px] font-bold leading-tight",
                    isDone ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {t(step.key)}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      {order.status === "served" &&
        order.paymentStatus === "pending" &&
        (order.paymentMethod === "stripe" || order.paymentMethod === "vnpay") && (
          <section className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
            <p className="mb-3 text-sm font-medium text-card-foreground">{t("payNowPrompt")}</p>
            {paymentNotice && <p className="mb-3 text-sm text-destructive">{t("paymentRetryNotice")}</p>}
            <Button className="h-11 w-full rounded-xl" disabled={isPaying} onClick={handlePayNow}>
              {isPaying ? t("payNowLoading") : t("payNowButton")}
            </Button>
          </section>
        )}

      <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary/20 text-secondary">
            {order.orderType === "dine-in" ? <TableIcon className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}
          </div>
          <div>
            <h4 className="text-sm font-bold text-card-foreground">
              {order.orderType === "dine-in" ? t("tableLabel", { table: order.table ?? table ?? "" }) : t("pickupBadge")}
            </h4>
            {order.orderType === "dine-in" && (
              <p className="text-xs text-muted-foreground">{t("dineInBadge")}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent/30 text-accent-foreground">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-card-foreground">{t("branchName")}</h4>
          </div>
        </div>
      </section>

      <section className="mt-8 space-y-3">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="text-lg font-semibold text-card-foreground">{t("orderDetails")}</h3>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-secondary">
            {t("itemCount", { count: order.items.length })}
          </span>
        </div>
        <div className="space-y-2">
          {order.items.map((item, index) => (
            <div key={index} className="flex items-center justify-between rounded-xl p-3">
              <div>
                <h5 className="font-bold text-card-foreground">
                  {item.quantity}x {locale === "vi" ? item.nameVi : item.nameEn}
                </h5>
                {item.note && <p className="text-xs italic text-accent-foreground">+ {item.note}</p>}
              </div>
              <span className="text-sm font-bold text-primary">{formatVND(item.unitPrice * item.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="space-y-2 rounded-xl bg-muted p-4">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{t("subtotal")}</span>
            <span>{formatVND(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{t("discount")}</span>
            <span className="text-destructive">-{formatVND(order.discount)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t pt-2">
            <span className="font-bold text-card-foreground">{t("total")}</span>
            <span className="text-xl font-black text-primary">{formatVND(order.total)}</span>
          </div>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 p-4 backdrop-blur-md">
        <a
          href={`tel:${MOCK_SHOP_PHONE}`}
          className="mx-auto flex max-w-2xl items-center justify-center gap-2 rounded-xl bg-primary py-4 font-bold text-primary-foreground shadow-lg transition-transform active:scale-95"
        >
          <Phone className="h-5 w-5" />
          {t("contactShop")}
        </a>
      </div>
    </div>
  )
}
