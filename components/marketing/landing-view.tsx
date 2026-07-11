"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Coffee, CupSoda, Cookie, Milk, Sparkles, ArrowRight } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { LandingNav } from "@/components/marketing/landing-nav"
import { SpotlightHero } from "@/components/marketing/spotlight-hero"
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
    <div className="w-full">
      <div className="relative">
        <LandingNav />
        <SpotlightHero onScanQr={() => setIsScannerOpen(true)} />
      </div>

      <div className="mx-auto w-full max-w-2xl md:max-w-6xl md:px-8">
        <section className="px-4 pt-6 md:px-0">
          <div className="relative overflow-hidden rounded-xl border bg-muted p-5 shadow-sm md:p-8">
            <div className="mb-2 flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">{t("promoLabel")}</span>
            </div>
            <h3 className="mb-1 font-bold text-card-foreground md:text-xl">{t("promoTitle")}</h3>
            <p className="mb-3 text-sm text-muted-foreground md:text-base md:max-w-2xl">{t("promoDescription")}</p>
            <span className="inline-block rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground">
              {t("promoBadge")}
            </span>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between px-4 md:px-0">
            <div>
              <h3 className="font-bold text-card-foreground md:text-xl">{t("bestSellers")}</h3>
              <div className="mt-1 h-1 w-10 rounded-full bg-primary" />
            </div>
            <Link href="/menu" className="text-sm font-medium text-secondary hover:underline">
              {t("viewAll")}
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 pb-2 md:grid md:grid-cols-4 md:gap-6 md:overflow-x-visible md:px-0">
            {bestSellers.map((item) => {
              const Icon = ICONS[item.icon]
              const name = locale === "vi" ? item.nameVi : item.nameEn
              return (
                <Link
                  key={item.id}
                  href="/menu"
                  className="flex w-36 shrink-0 flex-col gap-2 rounded-xl md:w-auto md:shrink group"
                >
                  <div className="flex h-32 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-all group-hover:scale-[1.03] group-hover:shadow-md md:h-40">
                    <Icon className="h-10 w-10 md:h-12 md:w-12" />
                  </div>
                  <h4 className="text-sm font-semibold leading-tight text-card-foreground group-hover:text-primary transition-colors">{name}</h4>
                  <span className="font-bold text-primary">{formatVND(item.basePrice)}</span>
                </Link>
              )
            })}
          </div>
        </section>

        <section className="mt-8 flex gap-2 overflow-x-auto px-4 pb-8 md:flex-wrap md:justify-center md:gap-4 md:px-0">
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
      </div>

      {isScannerOpen && <QrScannerOverlay onClose={() => setIsScannerOpen(false)} />}
    </div>
  )
}
