"use client"

import { useTranslations } from "next-intl"
import { Banknote, Clock, CreditCard, QrCode } from "lucide-react"
import { formatVND, formatOrderId } from "@/lib/format"
import type { ShiftReport } from "@/lib/supabase/shift-data"

const METHOD_META = {
  cash: { icon: Banknote, labelKey: "methodCash" },
  stripe: { icon: CreditCard, labelKey: "methodStripe" },
  vnpay: { icon: QrCode, labelKey: "methodVnpay" },
} as const

export function formatDateTime(timestamp: number, locale: string): string {
  return new Date(timestamp).toLocaleString(locale === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

export function ShiftReportDetail({ report, locale }: { report: ShiftReport; locale: string }) {
  const t = useTranslations("AdminShift")

  return (
    <div className="flex flex-col gap-4">
      <section className="nb-border-sm nb-shadow-sm rounded-xl bg-card p-5">
        <p className="mb-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          {t("openedAtLabel")}: {formatDateTime(report.openedAt, locale)}
          {report.closedAt !== null && (
            <>
              {" · "}
              {t("closedAtLabel")}: {formatDateTime(report.closedAt, locale)}
            </>
          )}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">{t("startingCashStat")}</p>
            <p className="font-bold text-card-foreground">{formatVND(report.startingCash)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("expectedCashStat")}</p>
            <p className="font-bold text-card-foreground">{formatVND(report.expectedCash)}</p>
          </div>
          {report.countedCash !== null && (
            <div>
              <p className="text-xs text-muted-foreground">{t("countedCashStat")}</p>
              <p className="font-bold text-card-foreground">{formatVND(report.countedCash)}</p>
            </div>
          )}
          {report.difference !== null && (
            <div>
              <p className="text-xs text-muted-foreground">{t("differenceStat")}</p>
              <p
                className={
                  report.difference === 0
                    ? "font-bold text-green-600"
                    : report.difference > 0
                      ? "font-bold text-amber-600"
                      : "font-bold text-destructive"
                }
              >
                {report.difference === 0
                  ? t("differenceExact")
                  : `${report.difference > 0 ? t("differenceOver") : t("differenceShort")} ${formatVND(Math.abs(report.difference))}`}
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="nb-border-sm nb-shadow-sm rounded-xl bg-card p-5">
        <h3 className="mb-3 font-bold text-card-foreground">{t("byMethodTitle")}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(["cash", "stripe", "vnpay"] as const).map((method) => {
            const row = report.byMethod.find((m) => m.method === method)
            const Icon = METHOD_META[method].icon
            return (
              <div key={method} className="nb-border-sm flex items-center gap-3 rounded-lg bg-chip p-3">
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

      <section className="nb-border-sm nb-shadow-sm rounded-xl bg-card p-5">
        <h3 className="mb-3 font-bold text-card-foreground">{t("transactionsTitle")}</h3>
        {report.transactions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("emptyTransactions")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {report.transactions.map((txn) => (
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
    </div>
  )
}
