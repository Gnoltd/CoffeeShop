"use client"

import { useTranslations } from "next-intl"
import { Star, Info, Gift, ArrowRight, CheckCircle2, PartyPopper, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatNumber } from "@/lib/format"

/**
 * No loyalty_settings/loyalty_transactions tables yet — fixed mock numbers
 * matching the approved Stitch mockup. Real rates already agreed for the DB
 * (see continuity.md): 10,000 VND spent = 1 point, 100 points = 10,000 VND
 * discount — this page's copy uses those same real rates, not placeholder ones.
 */
const CURRENT_BALANCE = 1250
const POINTS_TO_NEXT_TIER = 250
const TIER_PROGRESS_PERCENT = 75

type TransactionType = "earned" | "redeemed" | "birthday"

type Transaction = {
  type: TransactionType
  date: string
  ref: string
  points: number
}

const MOCK_TRANSACTIONS: Transaction[] = [
  { type: "earned", date: "03/07/2026", ref: "#PDC-9788", points: 45 },
  { type: "redeemed", date: "01/07/2026", ref: "Voucher 10k", points: -100 },
  { type: "earned", date: "28/06/2026", ref: "#PDC-9712", points: 120 },
  { type: "birthday", date: "20/06/2026", ref: "Gift for you!", points: 500 },
]

const TRANSACTION_META: Record<
  TransactionType,
  { icon: typeof CheckCircle2; iconClass: string; amountClass: string; labelKey: "earned" | "redeemed" | "birthdayBonus" }
> = {
  earned: { icon: CheckCircle2, iconClass: "bg-green-100 text-green-700", amountClass: "text-green-600", labelKey: "earned" },
  redeemed: { icon: Gift, iconClass: "bg-primary/10 text-primary", amountClass: "text-primary", labelKey: "redeemed" },
  birthday: { icon: PartyPopper, iconClass: "bg-accent/30 text-accent-foreground", amountClass: "text-accent-foreground", labelKey: "birthdayBonus" },
}

export function LoyaltyView() {
  const t = useTranslations("Loyalty")

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-4">
      <section className="rounded-xl border bg-muted p-5 shadow-sm">
        <div className="mb-2 flex items-center gap-2 text-primary">
          <Star className="h-4 w-4" fill="currentColor" />
          <span className="text-xs font-bold uppercase tracking-wider text-secondary">
            {t("currentBalance")}
          </span>
        </div>
        <div className="mb-4 flex items-baseline gap-2">
          <span className="text-5xl font-extrabold text-primary">{formatNumber(CURRENT_BALANCE)}</span>
          <span className="font-bold text-primary/80">{t("pts")}</span>
        </div>
        <div className="space-y-3 rounded-xl border bg-card/60 p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 shrink-0 text-secondary" />
            <p className="text-sm text-card-foreground">{t("earnRateInfo")}</p>
          </div>
          <div className="flex items-start gap-3">
            <Gift className="h-5 w-5 shrink-0 text-secondary" />
            <p className="text-sm text-card-foreground">{t("redeemRateInfo")}</p>
          </div>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col justify-between rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="font-bold text-card-foreground">{t("tierName")}</h3>
          <div className="mt-4">
            <div className="mb-2 h-2 w-full rounded-full bg-muted">
              <div className="h-full rounded-full bg-accent" style={{ width: `${TIER_PROGRESS_PERCENT}%` }} />
            </div>
            <p className="text-xs text-secondary">{t("tierProgress", { points: POINTS_TO_NEXT_TIER })}</p>
          </div>
        </div>
        <button
          type="button"
          disabled
          title="Not implemented yet — no rewards catalog to redeem from"
          className="flex flex-col justify-between rounded-xl bg-primary/40 p-4 text-left text-primary-foreground opacity-70"
        >
          <h3 className="font-bold">{t("redeemAction")}</h3>
          <div className="mt-4 flex justify-end">
            <ArrowRight className="h-8 w-8" />
          </div>
        </button>
      </section>

      <section className="mt-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 text-accent-foreground">
          <Sparkles className="h-4 w-4" />
          <h3 className="font-bold text-card-foreground">{t("promoTitle")}</h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t("promoSubtitle")}</p>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold text-card-foreground">{t("historyTitle")}</h3>
          <button
            type="button"
            disabled
            title="Not implemented yet — no more transaction history to load"
            className="flex items-center gap-1 text-sm font-bold text-secondary opacity-50"
          >
            {t("viewAll")}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {MOCK_TRANSACTIONS.map((transaction, index) => {
            const meta = TRANSACTION_META[transaction.type]
            const Icon = meta.icon
            return (
              <div
                key={index}
                className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", meta.iconClass)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-card-foreground">{t(meta.labelKey)}</p>
                    <p className="text-xs text-muted-foreground">
                      {transaction.date} · {transaction.ref}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn("font-bold", meta.amountClass)}>
                    {transaction.points > 0 ? "+" : ""}
                    {transaction.points}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{t("pointsUnit")}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
