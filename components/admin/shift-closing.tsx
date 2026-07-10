"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Banknote, Clock, Wallet, CreditCard, QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatVND, formatOrderId } from "@/lib/format"
import { useShift } from "@/hooks/useShift"
import { openShift, closeShift, type ShiftReport } from "@/lib/supabase/shift-data"

const METHOD_META = {
  cash: { icon: Banknote, labelKey: "methodCash" },
  stripe: { icon: CreditCard, labelKey: "methodStripe" },
  vnpay: { icon: QrCode, labelKey: "methodVnpay" },
} as const

function formatDateTime(timestamp: number, locale: string): string {
  return new Date(timestamp).toLocaleString(locale === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

export function ShiftClosing() {
  const t = useTranslations("AdminShift")
  const locale = useLocale()
  const { supabase, report, isLoading, refetch } = useShift()
  const [startingCashInput, setStartingCashInput] = useState("")
  const [countedCashInput, setCountedCashInput] = useState("")
  const [notesInput, setNotesInput] = useState("")
  const [closedSummary, setClosedSummary] = useState<ShiftReport | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleOpen() {
    const amount = Number(startingCashInput)
    if (!Number.isFinite(amount) || amount < 0) return
    setError(null)
    setIsSubmitting(true)
    try {
      await openShift(supabase, Math.round(amount))
      setStartingCashInput("")
      setClosedSummary(null)
      refetch()
    } catch {
      setError(t("openError"))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleClose() {
    const amount = Number(countedCashInput)
    if (!Number.isFinite(amount) || amount < 0) return
    setError(null)
    setIsSubmitting(true)
    try {
      const summary = await closeShift(supabase, Math.round(amount), notesInput.trim() || undefined)
      setClosedSummary(summary)
      setCountedCashInput("")
      setNotesInput("")
      refetch()
    } catch {
      setError(t("closeError"))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return <p className="py-16 text-center text-muted-foreground">{t("loading")}</p>
  }

  const active = report

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <h2 className="text-2xl font-bold text-card-foreground">{t("title")}</h2>
      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {closedSummary && !active && (
        <section className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5">
          <h3 className="mb-3 text-lg font-bold text-card-foreground">{t("closedSummaryTitle")}</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">{t("startingCashStat")}</p>
              <p className="font-bold text-card-foreground">{formatVND(closedSummary.startingCash)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("expectedCashStat")}</p>
              <p className="font-bold text-card-foreground">{formatVND(closedSummary.expectedCash)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("countedCashStat")}</p>
              <p className="font-bold text-card-foreground">{formatVND(closedSummary.countedCash ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("differenceStat")}</p>
              <p
                className={
                  (closedSummary.difference ?? 0) === 0
                    ? "font-bold text-green-600"
                    : (closedSummary.difference ?? 0) > 0
                      ? "font-bold text-amber-600"
                      : "font-bold text-destructive"
                }
              >
                {(closedSummary.difference ?? 0) === 0
                  ? t("differenceExact")
                  : `${(closedSummary.difference ?? 0) > 0 ? t("differenceOver") : t("differenceShort")} ${formatVND(Math.abs(closedSummary.difference ?? 0))}`}
              </p>
            </div>
          </div>
        </section>
      )}

      {!active ? (
        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="mb-1 flex items-center gap-2 font-bold text-card-foreground">
            <Wallet className="h-5 w-5 text-primary" />
            {t("noShiftTitle")}
          </h3>
          <label className="mb-1 mt-3 block text-xs font-medium text-muted-foreground">
            {t("startingCashLabel")}
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              value={startingCashInput}
              onChange={(e) => setStartingCashInput(e.target.value)}
              className="h-11 w-full max-w-xs rounded-xl border bg-card px-4 text-card-foreground"
            />
            <Button className="h-11" disabled={isSubmitting || startingCashInput === ""} onClick={handleOpen}>
              {t("openShiftButton")}
            </Button>
          </div>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <p className="mb-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {t("openedAtLabel")}: {formatDateTime(active.openedAt, locale)}
              </p>
              <p className="text-xs text-muted-foreground">{t("startingCashStat")}</p>
              <h3 className="text-xl font-bold text-card-foreground">{formatVND(active.startingCash)}</h3>
            </div>
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <p className="mb-1 text-sm text-muted-foreground">{t("cashSalesStat")}</p>
              <h3 className="text-xl font-bold text-card-foreground">
                {formatVND(active.byMethod.find((m) => m.method === "cash")?.total ?? 0)}
              </h3>
            </div>
            <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-5 shadow-sm">
              <p className="mb-1 text-sm text-muted-foreground">{t("expectedCashStat")}</p>
              <h3 className="text-xl font-bold text-primary">{formatVND(active.expectedCash)}</h3>
            </div>
          </section>

          <section className="rounded-xl border bg-card p-5 shadow-sm">
            <h3 className="mb-3 font-bold text-card-foreground">{t("byMethodTitle")}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(["cash", "stripe", "vnpay"] as const).map((method) => {
                const row = active.byMethod.find((m) => m.method === method)
                const Icon = METHOD_META[method].icon
                return (
                  <div key={method} className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {t(METHOD_META[method].labelKey)} · {t("ordersCount", { count: row?.count ?? 0 })}
                      </p>
                      <p className="font-bold text-card-foreground">{formatVND(row?.total ?? 0)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="rounded-xl border bg-card p-5 shadow-sm">
            <h3 className="mb-3 font-bold text-card-foreground">{t("transactionsTitle")}</h3>
            {active.transactions.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("emptyTransactions")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {active.transactions.map((txn) => (
                      <tr key={txn.id} className="border-b last:border-0">
                        <td className="px-2 py-2 font-bold text-primary">#{formatOrderId(txn.id)}</td>
                        <td className="px-2 py-2 text-muted-foreground">{formatDateTime(txn.paidAt, locale)}</td>
                        <td className="px-2 py-2 text-muted-foreground">
                          {t(METHOD_META[txn.paymentMethod as keyof typeof METHOD_META]?.labelKey ?? "methodCash")}
                        </td>
                        <td className="px-2 py-2 text-right font-bold text-card-foreground">{formatVND(txn.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-xl border bg-card p-5 shadow-sm">
            <h3 className="mb-3 font-bold text-card-foreground">{t("closeShiftTitle")}</h3>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("countedCashLabel")}</label>
                <input
                  type="number"
                  min="0"
                  value={countedCashInput}
                  onChange={(e) => setCountedCashInput(e.target.value)}
                  className="h-11 w-full rounded-xl border bg-card px-4 text-card-foreground"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("notesLabel")}</label>
                <input
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  className="h-11 w-full rounded-xl border bg-card px-4 text-card-foreground"
                />
              </div>
              <Button className="h-11" disabled={isSubmitting || countedCashInput === ""} onClick={handleClose}>
                {t("closeShiftButton")}
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
