"use client"

import { useTranslations } from "next-intl"
import {
  Coffee,
  LayoutDashboard,
  UtensilsCrossed,
  Package,
  Table2,
  Users,
  Calculator,
  Settings,
} from "lucide-react"
import { Link, usePathname } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/admin/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/admin/menu", labelKey: "menu", icon: UtensilsCrossed },
  { href: "/admin/inventory", labelKey: "inventory", icon: Package },
  { href: "/admin/tables", labelKey: "tables", icon: Table2 },
  { href: "/admin/staff", labelKey: "staff", icon: Users },
  { href: "/admin/food-cost", labelKey: "foodCost", icon: Calculator },
  { href: "/admin/settings", labelKey: "settings", icon: Settings },
] as const

export function AdminSidebar() {
  const tBrand = useTranslations("Brand")
  const tNav = useTranslations("Nav")
  const pathname = usePathname()

  return (
    <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-r bg-card py-4">
      <div className="mb-6 flex items-center gap-2 px-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Coffee className="h-5 w-5" />
        </div>
        <span className="font-bold text-primary">{tBrand("name")}</span>
      </div>
      <nav className="flex-1 space-y-1 px-2">
        {NAV_ITEMS.map(({ href, labelKey, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Icon className="h-4 w-4" />
              {tNav(labelKey)}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
