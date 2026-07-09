"use client"

import { useTranslations } from "next-intl"
import { Coffee, Menu } from "lucide-react"
import { Link } from "@/i18n/navigation"

export function AdminMobileHeader({ onOpenMenu }: { onOpenMenu: () => void }) {
  const tBrand = useTranslations("Brand")
  const tNav = useTranslations("Nav")

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4 md:hidden">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label={tNav("openMenu")}
        className="rounded-lg p-2 text-card-foreground transition-colors hover:bg-muted"
      >
        <Menu className="h-5 w-5" />
      </button>
      <Link href="/" className="flex items-center gap-2 font-bold text-primary">
        <Coffee className="h-5 w-5" />
        {tBrand("name")}
      </Link>
    </header>
  )
}
