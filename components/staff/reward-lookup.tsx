"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Search, Gift, CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatNumber } from "@/lib/format"
import { createClient } from "@/lib/supabase/client"
import {
  findRedemptionByCode,
  fulfillRedemption,
  type RedemptionLookup,
} from "@/lib/supabase/rewards-data"

function formatDateTime(timestamp: number, locale: string): string {
  return new Date(timestamp).toLocaleString(locale === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

export function RewardLookup() {
  const t = useTranslations("StaffRewards")
  const locale = useLocale()
  const [supabase] = useState(() => createClient())
  const [code, setCode] = useState("")
  const [results, setResults] = useState<RedemptionLookup[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [fulfillingId, setFulfillingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSearch() {
    const trimmed = code.trim()
    if (!trimmed) return
    setError(null)
    setIsSearching(true)
    try {
      const found = await findRedemptionByCode(supabase, trimmed)
      setResults(found)
    } catch {
      setError(t("searchError"))
      setResults(null)
    } finally {
      setIsSearching(false)
    }
  }

  async function handleFulfill(redemption: RedemptionLookup) {
    setError(null)
    setFulfillingId(redemption.id)
    try {
      const fulfilledAt = await fulfillRedemption(supabase, redemption.id)
      setResults((prev) => prev?.map((r) => (r.id === redemption.id ? { ...r, fulfilledAt } : r)) ?? null)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setError(message.includes("already_fulfilled") ? t("alreadyFulfilledError") : t("fulfillError"))
    } finally {
      setFulfillingId(null)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h2 className="text-2xl font-bold text-card-foreground">{t("title")}</h2>
      <p className="text-sm text-muted-foreground">{t("subtitle")}</p>

      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder={t("codePlaceholder")}
          className="h-12 rounded-xl font-mono text-lg tracking-widest"
        />
        <Button className="h-12 shrink-0 rounded-xl px-5" disabled={isSearching || !code.trim()} onClick={handleSearch}>
          {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
        </Button>
      </div>

      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {results !== null && results.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("noMatch")}</p>
      )}

      {results !== null &&
        results.map((redemption) => (
          <div key={redemption.id} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Gift className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-bold text-card-foreground">
                    {locale === "vi" ? redemption.rewardNameVi : redemption.rewardNameEn}
                  </p>
                  <p className="text-sm text-muted-foreground">{redemption.customerName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("redeemedAtLabel")}: {formatDateTime(redemption.redeemedAt, locale)} ·{" "}
                    {formatNumber(redemption.pointsSpent)} {t("pointsUnit")}
                  </p>
                </div>
              </div>
              {redemption.fulfilledAt !== null ? (
                <span className="flex shrink-0 items-center gap-1 rounded-lg bg-green-100 px-3 py-1.5 text-xs font-bold text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  {t("fulfilledLabel")}
                </span>
              ) : (
                <Button
                  className="h-10 shrink-0 rounded-xl px-4"
                  disabled={fulfillingId === redemption.id}
                  onClick={() => handleFulfill(redemption)}
                >
                  {fulfillingId === redemption.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t("markFulfilledButton")
                  )}
                </Button>
              )}
            </div>
            {redemption.fulfilledAt !== null && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("fulfilledAtLabel")}: {formatDateTime(redemption.fulfilledAt, locale)}
              </p>
            )}
          </div>
        ))}
    </div>
  )
}
