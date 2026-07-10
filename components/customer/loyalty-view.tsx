"use client"

import { useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Star, Info, Gift, ArrowRight, CheckCircle2, Wallet, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatNumber, formatDateVN, formatOrderId } from "@/lib/format"
import { createClient } from "@/lib/supabase/client"
import { getLoyaltyBalance, getLoyaltyTierProgress, getLoyaltyTransactions, type LoyaltyTierProgress, type LoyaltyTransaction, type LoyaltyTransactionType } from "@/lib/supabase/loyalty-data"
import { AnimatedCounter } from "@/components/motion/animated-counter"
import { ProgressRing } from "@/components/motion/progress-ring"
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list"

const TRANSACTION_META: Record<
  LoyaltyTransactionType,
  { icon: typeof CheckCircle2; iconClass: string; amountClass: string; labelKey: "earned" | "redeemed" | "adjusted" }
> = {
  earn: { icon: CheckCircle2, iconClass: "bg-green-100 text-green-700", amountClass: "text-green-600", labelKey: "earned" },
  redeem: { icon: Gift, iconClass: "bg-primary/10 text-primary", amountClass: "text-primary", labelKey: "redeemed" },
  adjust: { icon: Wallet, iconClass: "bg-accent/30 text-accent-foreground", amountClass: "text-accent-foreground", labelKey: "adjusted" },
}

export function LoyaltyView() {
  const t = useTranslations("Loyalty")
  const locale = useLocale()
  const [supabase] = useState(() => createClient())
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([])
  const [tier, setTier] = useState<LoyaltyTierProgress | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      getLoyaltyBalance(supabase, user.id).then(setBalance)
      getLoyaltyTierProgress(supabase).then(setTier)
    })
    getLoyaltyTransactions(supabase).then(setTransactions)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const currentTierName = tier ? (locale === "vi" ? tier.currentTierNameVi : tier.currentTierNameEn) : ""
  const nextTierName = tier ? (locale === "vi" ? tier.nextTierNameVi : tier.nextTierNameEn) : null
  const progressPercent = tier?.progressPercent ?? 0

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
          <AnimatedCounter value={balance} format={formatNumber} className="text-5xl font-extrabold text-primary" />
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
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="self-start font-bold text-card-foreground">{currentTierName}</h3>
          <ProgressRing percent={progressPercent} size={88} strokeWidth={7}>
            <span className="text-lg font-bold text-accent-foreground">{progressPercent}%</span>
          </ProgressRing>
          <p className="text-center text-xs text-secondary">
            {nextTierName && tier?.pointsToNext != null
              ? t("tierProgress", { points: tier.pointsToNext, tier: nextTierName })
              : t("tierMaxReached")}
          </p>
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
        {transactions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("noHistory")}</p>
        ) : (
          <StaggerList className="flex flex-col gap-2">
            {transactions.map((transaction) => {
              const meta = TRANSACTION_META[transaction.type]
              const Icon = meta.icon
              return (
                <StaggerItem key={transaction.id}>
                  <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", meta.iconClass)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-card-foreground">{t(meta.labelKey)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateVN(new Date(transaction.createdAt))}
                          {transaction.orderId && ` · #${formatOrderId(transaction.orderId)}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("font-bold", meta.amountClass)}>
                        {transaction.pointsChange > 0 ? "+" : ""}
                        {transaction.pointsChange}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{t("pointsUnit")}</p>
                    </div>
                  </div>
                </StaggerItem>
              )
            })}
          </StaggerList>
        )}
      </section>
    </div>
  )
}
