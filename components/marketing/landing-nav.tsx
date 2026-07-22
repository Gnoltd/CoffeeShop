"use client"

import { Coffee } from "lucide-react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { useHeaderActionsClearance } from "@/hooks/useHeaderActionsClearance"

const NAV_LINKS = [
  { key: "navMenu", href: "/menu" },
  { key: "navOrders", href: "/orders" },
  { key: "navLoyalty", href: "/loyalty" },
  { key: "navProfile", href: "/profile" },
] as const

export function LandingNav() {
  const t = useTranslations("Landing")
  const signUpClearance = useHeaderActionsClearance()

  return (
    <nav className="absolute top-0 left-0 right-0 z-[60] flex items-center justify-between p-4 sm:p-5">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-24 bg-gradient-to-b from-black/55 to-transparent sm:h-28"
        aria-hidden
      />
      <span className="flex items-center gap-2">
        <Coffee className="h-[26px] w-[26px] text-white" aria-hidden />
        <span className="font-playfair text-2xl italic text-white">PhaDinCoffee</span>
      </span>
      <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-full border border-white/30 bg-white/20 px-2 py-2 backdrop-blur-md md:flex">
        {NAV_LINKS.map(({ key, href }) => (
          <Link
            key={key}
            href={href}
            className="rounded-full px-4 py-1.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          >
            {t(key)}
          </Link>
        ))}
      </div>
      <Link
        href="/signup"
        style={{ marginRight: signUpClearance }}
        className="hidden rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-100 md:block"
      >
        {t("navSignUp")}
      </Link>
    </nav>
  )
}
