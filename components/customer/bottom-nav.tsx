"use client"

import { useTranslations } from "next-intl"
import { UtensilsCrossed, ShoppingBasket, ReceiptText, User, Star } from "lucide-react"
import { Link, usePathname } from "@/i18n/navigation"
import { cn } from "@/lib/utils"
import { useCart } from "@/hooks/useCart"

const NAV_ITEMS = [
  { href: "/menu", labelKey: "menu", icon: UtensilsCrossed } as const,
  { href: "/cart", labelKey: "cart", icon: ShoppingBasket } as const,
  { href: "/orders", labelKey: "orders", icon: ReceiptText } as const,
  { href: "/loyalty", labelKey: "loyalty", icon: Star } as const,
  { href: "/profile", labelKey: "profile", icon: User } as const,
]

/** Focused, single-task pages hide the tab bar rather than compete with their own primary action. */
function isFocusedPage(pathname: string): boolean {
  return (
    pathname === "/checkout" ||
    (pathname.startsWith("/orders/") && pathname !== "/orders") ||
    (pathname.startsWith("/menu/") && pathname !== "/menu")
  )
}

export function BottomNav() {
  const t = useTranslations("Nav")
  const pathname = usePathname()
  const { itemCount } = useCart()

  if (isFocusedPage(pathname)) return null

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around rounded-t-xl bg-card px-2 py-2 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
      {NAV_ITEMS.map(({ href, labelKey, icon: Icon }) => {
        const isActive = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "relative flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-center text-[11px] font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <span className="relative">
              <Icon className="h-5 w-5" />
              {labelKey === "cart" && itemCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white ring-2 ring-card">
                  {itemCount}
                </span>
              )}
            </span>
            {t(labelKey)}
          </Link>
        )
      })}
    </nav>
  )
}
