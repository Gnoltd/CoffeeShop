import { Coffee, CupSoda, Cookie, Milk } from "lucide-react"
import { cn } from "@/lib/utils"
import type { MenuIcon, MenuItem } from "@/lib/supabase/menu-data"

export const ICONS: Record<MenuIcon, typeof Coffee> = {
  coffee: Coffee,
  "cup-soda": CupSoda,
  cookie: Cookie,
  milk: Milk,
}

/** Real uploaded photo when set, falling back to the item's category icon — used anywhere a menu item's image appears (menu, landing best sellers, product detail). */
export function ItemImage({ item, className }: { item: MenuItem; className?: string }) {
  if (item.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.imageUrl} alt="" className={cn("object-cover", className)} />
  }
  const Icon = ICONS[item.icon]
  return (
    <div className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}>
      <Icon className="h-8 w-8" />
    </div>
  )
}
