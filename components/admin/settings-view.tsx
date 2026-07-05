"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Store, Gift, Check } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type SettingsState = {
  shopName: string
  address: string
  phone: string
  openingHours: string
  taxRate: string
  loyaltyEnabled: boolean
  earnRate: string
  redeemRate: string
}

/**
 * No `shop_settings`/`loyalty_settings` tables yet — this form only holds
 * local state and never persists. Defaults match the rates agreed for the
 * real schema: 10,000 VND spent = 1 point, 100 points = 10,000 VND off.
 */
const DEFAULT_SETTINGS: SettingsState = {
  shopName: "PhaDinCoffee",
  address: "123 Lê Lợi, Bến Thành, Quận 1, TP. HCM",
  phone: "028 3823 4567",
  openingHours: "07:00 - 22:00",
  taxRate: "8",
  loyaltyEnabled: true,
  earnRate: "10000",
  redeemRate: "100",
}

export function SettingsView() {
  const t = useTranslations("AdminSettings")

  const [savedSettings, setSavedSettings] = useState(DEFAULT_SETTINGS)
  const [draft, setDraft] = useState(DEFAULT_SETTINGS)
  const [justSaved, setJustSaved] = useState(false)

  function update<K extends keyof SettingsState>(key: K, value: SettingsState[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    // No backend to persist to yet — just commits the local draft as "saved".
    setSavedSettings(draft)
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 2000)
  }

  function handleCancel() {
    setDraft(savedSettings)
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h2 className="text-2xl font-bold text-card-foreground">{t("shopInfo")}</h2>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Store className="h-5 w-5 text-primary" />
            {t("shopInfo")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="shop-name">{t("shopName")}</Label>
            <Input
              id="shop-name"
              value={draft.shopName}
              onChange={(e) => update("shopName", e.target.value)}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">{t("address")}</Label>
            <Input
              id="address"
              value={draft.address}
              onChange={(e) => update("address", e.target.value)}
              className="h-10"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">{t("phone")}</Label>
              <Input
                id="phone"
                value={draft.phone}
                onChange={(e) => update("phone", e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hours">{t("openingHours")}</Label>
              <Input
                id="hours"
                value={draft.openingHours}
                onChange={(e) => update("openingHours", e.target.value)}
                className="h-10"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tax-rate">{t("taxRate")}</Label>
            <Input
              id="tax-rate"
              type="number"
              min="0"
              value={draft.taxRate}
              onChange={(e) => update("taxRate", e.target.value)}
              className="h-10 max-w-[140px]"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-lg">
            <span className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              {t("loyaltySettings")}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={draft.loyaltyEnabled}
              aria-label={t("loyaltyEnabled")}
              onClick={() => update("loyaltyEnabled", !draft.loyaltyEnabled)}
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                draft.loyaltyEnabled ? "bg-primary" : "bg-muted-foreground/30"
              )}
            >
              <span
                className={cn(
                  "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                  draft.loyaltyEnabled ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent className={cn("space-y-4 transition-opacity", !draft.loyaltyEnabled && "opacity-50")}>
          <div className="space-y-2">
            <Label htmlFor="earn-rate">{t("earnRate")}</Label>
            <Input
              id="earn-rate"
              type="number"
              min="0"
              disabled={!draft.loyaltyEnabled}
              value={draft.earnRate}
              onChange={(e) => update("earnRate", e.target.value)}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="redeem-rate">{t("redeemRate")}</Label>
            <Input
              id="redeem-rate"
              type="number"
              min="0"
              disabled={!draft.loyaltyEnabled}
              value={draft.redeemRate}
              onChange={(e) => update("redeemRate", e.target.value)}
              className="h-10"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={handleCancel} className="h-11 px-6">
          {t("cancel")}
        </Button>
        <Button onClick={handleSave} className="h-11 px-6">
          {t("saveChanges")}
        </Button>
        {justSaved && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-green-600">
            <Check className="h-4 w-4" />
            {t("savedMessage")}
          </span>
        )}
      </div>
    </div>
  )
}
