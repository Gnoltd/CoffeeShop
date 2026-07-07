"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Coffee, CupSoda, Cookie, Milk, QrCode, Sparkles, ArrowRight } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { formatVND } from "@/lib/format"
import { QrScannerOverlay } from "@/components/customer/qr-scanner-overlay"
import type { MenuItem, MenuIcon } from "@/lib/supabase/menu-data"

const ICONS: Record<MenuIcon, typeof Coffee> = {
  coffee: Coffee,
  "cup-soda": CupSoda,
  cookie: Cookie,
  milk: Milk,
}

const CATEGORY_CHIPS = [
  { id: "coffee", labelVi: "Cà Phê", labelEn: "Coffee" },
  { id: "tea", labelVi: "Trà", labelEn: "Tea" },
  { id: "pastries", labelVi: "Bánh Ngọt", labelEn: "Pastries" },
  { id: "blended", labelVi: "Đá Xay", labelEn: "Blended" },
]

export function LandingView({ bestSellers }: { bestSellers: MenuItem[] }) {
  const locale = useLocale()
  const t = useTranslations("Landing")
  const [isScannerOpen, setIsScannerOpen] = useState(false)

  return (
    <div className="mx-auto w-full max-w-2xl">
      <section className="relative flex h-[50vh] min-h-[360px] flex-col justify-end overflow-hidden bg-gradient-to-br from-secondary to-foreground">
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="relative z-10 space-y-4 p-6 pb-8">
          <h1 className="text-2xl font-bold leading-tight text-white">{t("heroHeadline")}</h1>
          <p className="italic text-white/80">{t("heroSubheadline")}</p>
          <div className="flex flex-col gap-3">
            <Button
              className="h-14 rounded-xl text-base font-bold"
              render={<Link href="/menu" />}
              nativeButton={false}
            >
              {t("orderNow")}
            </Button>
            <Button
              variant="outline"
              className="h-14 rounded-xl border-2 border-white/70 bg-transparent text-base font-bold text-white hover:bg-white/10"
              onClick={() => setIsScannerOpen(true)}
            >
              <QrCode className="h-5 w-5" />
              {t("scanQr")}
            </Button>
          </div>
        </div>
      </section>

      <section className="px-4 pt-6">
        <div className="relative overflow-hidden rounded-xl border bg-muted p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-primary">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">{t("promoLabel")}</span>
          </div>
          <h3 className="mb-1 font-bold text-card-foreground">{t("promoTitle")}</h3>
          <p className="mb-3 text-sm text-muted-foreground">{t("promoDescription")}</p>
          <span className="inline-block rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground">
            {t("promoBadge")}
          </span>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-end justify-between px-4">
          <div>
            <h3 className="font-bold text-card-foreground">{t("bestSellers")}</h3>
            <div className="mt-1 h-1 w-10 rounded-full bg-primary" />
          </div>
          <Link href="/menu" className="text-sm font-medium text-secondary">
            {t("viewAll")}
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto px-4 pb-2">
          {bestSellers.map((item) => {
            const Icon = ICONS[item.icon]
            const name = locale === "vi" ? item.nameVi : item.nameEn
            return (
              <Link
                key={item.id}
                href="/menu"
                className="flex w-36 shrink-0 flex-col gap-2 rounded-xl"
              >
                <div className="flex h-32 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Icon className="h-10 w-10" />
                </div>
                <h4 className="text-sm font-semibold leading-tight text-card-foreground">{name}</h4>
                <span className="font-bold text-primary">{formatVND(item.basePrice)}</span>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="mt-6 flex gap-2 overflow-x-auto px-4 pb-8">
        <span className="mb-1 sr-only">{t("categories")}</span>
        {CATEGORY_CHIPS.map((category) => {
          const label = locale === "vi" ? category.labelVi : category.labelEn
          return (
            <Link
              key={category.id}
              href="/menu"
              className="flex shrink-0 items-center gap-1 rounded-full border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )
        })}
      </section>

      {isScannerOpen && <QrScannerOverlay onClose={() => setIsScannerOpen(false)} />}
    </div>
  )
}
