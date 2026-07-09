"use client"

import { useTranslations } from "next-intl"
import { Coffee } from "lucide-react"
import { Link, usePathname } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/staff/pos", labelKey: "pos" },
  { href: "/staff/orders", labelKey: "kitchenDisplay" },
] as const

export function StaffNav() {
  const tBrand = useTranslations("Brand")
  const tNav = useTranslations("Nav")
  const pathname = usePathname()

  return (
    <header className="flex min-h-14 shrink-0 flex-col items-start gap-5 border-b bg-card px-4 py-2 md:flex-row md:items-center md:gap-6 md:py-0">
      <Link href="/" className="flex items-center gap-2 font-semibold text-primary">
        <Coffee className="h-5 w-5" />
        {tBrand("name")}
      </Link>
      <nav className="flex gap-2">
        {NAV_ITEMS.map(({ href, labelKey }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              pathname === href
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {tNav(labelKey)}
          </Link>
        ))}
      </nav>
    </header>
  )
}
