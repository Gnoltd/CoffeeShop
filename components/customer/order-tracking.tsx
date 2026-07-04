import { CookingPot, Check, PackageCheck, CircleCheckBig, Clock, TableIcon, Store, Phone } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { formatVND } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * No orders/Realtime backend yet (see docs/superpowers/plans — Tasks 5, 7,
 * 9 not executed), so this page shows a fixed mock order ("Preparing",
 * step 2 of 4) matching the approved Stitch mockup's example numbers,
 * regardless of the orderId in the URL. Once Supabase exists, this becomes
 * a real Realtime-subscribed query keyed by orderId.
 */
const MOCK_SHOP_PHONE = "+84281234567"
const MOCK_CURRENT_STEP = 1 // 0=paid, 1=preparing, 2=ready, 3=completed

const STEPS = [
  { key: "stepPaid", icon: Check },
  { key: "stepPreparing", icon: CookingPot },
  { key: "stepReady", icon: PackageCheck },
  { key: "stepCompleted", icon: CircleCheckBig },
] as const

const MOCK_ITEMS = [
  { nameVi: "Phin Sữa Đá", nameEn: "Iced Milk Coffee", quantity: 1, price: 35000 },
  { nameVi: "Bánh Mì Que", nameEn: "Crispy Breadsticks", quantity: 2, price: 30000 },
]
const MOCK_SUBTOTAL = 65000
const MOCK_DISCOUNT = 5000
const MOCK_TOTAL = MOCK_SUBTOTAL - MOCK_DISCOUNT

export async function OrderTracking({
  orderId,
  locale,
  table,
}: {
  orderId: string
  locale: string
  table?: string
}) {
  const t = await getTranslations("OrderTracking")
  const progressPercent = (MOCK_CURRENT_STEP / (STEPS.length - 1)) * 100

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4 sm:px-6">
      <section className="relative overflow-hidden rounded-xl border bg-muted p-6 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-secondary">{t("orderId")}</p>
        <h2 className="mb-4 text-3xl font-bold text-primary">#{orderId}</h2>
        <div className="mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-primary/15">
          <CookingPot className="h-12 w-12 text-primary" />
        </div>
        <h3 className="mb-1 text-xl font-semibold text-card-foreground">{t("statusPreparing")}</h3>
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 text-primary" />
          {t("etaLabel")}
        </p>
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
            const isDone = index <= MOCK_CURRENT_STEP
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

      <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary/20 text-secondary">
            <TableIcon className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-card-foreground">{t("tableLabel", { table: table ?? "04" })}</h4>
            <p className="text-xs text-muted-foreground">{t("dineInBadge")}</p>
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
            {t("itemCount", { count: MOCK_ITEMS.length })}
          </span>
        </div>
        <div className="space-y-2">
          {MOCK_ITEMS.map((item) => (
            <div key={item.nameEn} className="flex items-center justify-between rounded-xl p-3">
              <div>
                <h5 className="font-bold text-card-foreground">
                  {item.quantity}x {locale === "vi" ? item.nameVi : item.nameEn}
                </h5>
              </div>
              <span className="text-sm font-bold text-primary">{formatVND(item.price)}</span>
            </div>
          ))}
        </div>
        <div className="space-y-2 rounded-xl bg-muted p-4">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{t("subtotal")}</span>
            <span>{formatVND(MOCK_SUBTOTAL)}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{t("discount")}</span>
            <span className="text-destructive">-{formatVND(MOCK_DISCOUNT)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t pt-2">
            <span className="font-bold text-card-foreground">{t("total")}</span>
            <span className="text-xl font-black text-primary">{formatVND(MOCK_TOTAL)}</span>
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
