"use client"

import { AnimatePresence, motion } from "framer-motion"
import { usePathname } from "@/i18n/navigation"

export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -8 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
