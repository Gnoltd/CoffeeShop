"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Store, Gift, Check } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

/**
 * No `shop_settings`/`loyalty_settings` tables yet — this form only holds
 * local state and never persists. Defaults match the rates agreed for the
 * real schema: 10,000 VND spent = 1 point, 100 points = 10,000 VND off.
 */
export function SettingsView() {
  const t = useTranslations("AdminSettings")

  const [shopName, setShopName] = useState("PhaDinCoffee")
  const [address, setAddress] = useState("123 Lê Lợi, Bến Thành, Quận 1, TP. HCM")
  const [phone, setPhone] = useState("028 3823 4567")
  const [openingHours, setOpeningHours] = useState("07:00 - 22:00")
  const [taxRate, setTaxRate] = useState("8")
  const [earnRate, setEarnRate] = useState("10000")
  const [redeemRate, setRedeemRate] = useState("100")
  const [justSaved, setJustSaved] = useState(false)

  function handleSave() {
    // No backend to persist to yet — just acknowledges the local edit.
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 2000)
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
            <Input id="shop-name" value={shopName} onChange={(e) => setShopName(e.target.value)} className="h-10" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">{t("address")}</Label>
            <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} className="h-10" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">{t("phone")}</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hours">{t("openingHours")}</Label>
              <Input id="hours" value={openingHours} onChange={(e) => setOpeningHours(e.target.value)} className="h-10" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tax-rate">{t("taxRate")}</Label>
            <Input
              id="tax-rate"
              type="number"
              min="0"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              className="h-10 max-w-[140px]"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Gift className="h-5 w-5 text-primary" />
            {t("loyaltySettings")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="earn-rate">{t("earnRate")}</Label>
            <Input
              id="earn-rate"
              type="number"
              min="0"
              value={earnRate}
              onChange={(e) => setEarnRate(e.target.value)}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="redeem-rate">{t("redeemRate")}</Label>
            <Input
              id="redeem-rate"
              type="number"
              min="0"
              value={redeemRate}
              onChange={(e) => setRedeemRate(e.target.value)}
              className="h-10"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
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
