"use client"

import { useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Gift, Copy, Check } from "lucide-react"
import { formatVND, formatOrderId, formatDateVN } from "@/lib/format"
import { createClient } from "@/lib/supabase/client"
import { getMyRedemptions, type MyRedemption } from "@/lib/supabase/rewards-data"

function statusMeta(r: MyRedemption): { labelKey: "statusAvailable" | "statusUsed" | "statusExpired"; className: string } {
  if (r.isUsed) return { labelKey: "statusUsed", className: "bg-muted text-muted-foreground" }
  if (r.isExpired) return { labelKey: "statusExpired", className: "bg-destructive/10 text-destructive" }
  return { labelKey: "statusAvailable", className: "bg-green-100 text-green-700" }
}

export function MyRedemptionsView() {
  const t = useTranslations("MyRedemptions")
  const locale = useLocale()
  const [supabase] = useState(() => createClient())
  const [redemptions, setRedemptions] = useState<MyRedemption[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    getMyRedemptions(supabase)
      .then(setRedemptions)
      .catch(() => setError(t("loadError")))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleCopy(redemption: MyRedemption) {
    const code = formatOrderId(redemption.id)
    navigator.clipboard?.writeText(code).then(() => {
      setCopiedId(redemption.id)
      setTimeout(() => setCopiedId((prev) => (prev === redemption.id ? null : prev)), 1500)
    })
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-28 md:max-w-5xl md:px-8 md:py-4">
      <h2 className="mb-1 text-lg font-semibold text-card-foreground">{t("title")}</h2>
      <p className="mb-4 text-sm text-muted-foreground">{t("subtitle")}</p>

      {error && <p className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {redemptions === null ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("loading")}</p>
      ) : redemptions.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {redemptions.map((r) => {
            const status = statusMeta(r)
            const canUse = !r.isUsed && !r.isExpired
            return (
              <div key={r.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Gift className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-bold text-card-foreground">
                        {locale === "vi" ? r.rewardNameVi : r.rewardNameEn}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("redeemedOnLabel")}: {formatDateVN(new Date(r.redeemedAt))} ·{" "}
                        {formatVND(r.discountValueVnd)}
                      </p>
                      {canUse && (
                        <p className="text-xs text-muted-foreground">
                          {t("expiresOnLabel")}: {formatDateVN(new Date(r.expiresAt))}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${status.className}`}>
                    {t(status.labelKey)}
                  </span>
                </div>
                {canUse && (
                  <button
                    type="button"
                    onClick={() => handleCopy(r)}
                    className="mt-3 flex items-center gap-1.5 rounded-lg border bg-muted/40 px-3 py-2 font-mono text-sm font-bold tracking-widest text-card-foreground transition-colors hover:bg-muted"
                  >
                    {copiedId === r.id ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-green-600" />
                        {t("copiedLabel")}
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        {formatOrderId(r.id)}
                      </>
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
