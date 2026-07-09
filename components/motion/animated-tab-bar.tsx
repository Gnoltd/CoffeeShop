"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

export type TabItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

export function AnimatedTabBar({
  items,
  activeHref,
  renderLink,
}: {
  items: TabItem[]
  activeHref: string
  renderLink: (item: TabItem, isActive: boolean, content: React.ReactNode) => React.ReactNode
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around rounded-t-xl bg-card px-2 py-2 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
      {items.map((item) => {
        const isActive = item.href === activeHref
        const Icon = item.icon
        const content = (
          <span
            className={cn(
              "relative flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-center text-[11px] font-medium",
              isActive ? "text-primary-foreground" : "text-muted-foreground"
            )}
          >
            {isActive && (
              <motion.span
                layoutId="tab-bar-active-pill"
                className="absolute inset-0 rounded-xl bg-primary shadow-sm"
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
              />
            )}
            <span className="relative">
              <Icon className="h-5 w-5" />
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white ring-2 ring-card">
                  {item.badge}
                </span>
              )}
            </span>
            <span className="relative">{item.label}</span>
          </span>
        )
        return renderLink(item, isActive, content)
      })}
    </nav>
  )
}
