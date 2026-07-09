"use client"

import { AnimatePresence, motion } from "framer-motion"

const CONTAINER_VARIANTS = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}

const ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const } },
  exit: { opacity: 0, height: 0, marginBottom: 0, transition: { duration: 0.25 } },
}

export function StaggerList({
  children,
  staggerKey,
  className,
}: {
  children: React.ReactNode
  staggerKey?: string | number
  className?: string
}) {
  return (
    <motion.div key={staggerKey} variants={CONTAINER_VARIANTS} initial="hidden" animate="show" className={className}>
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </motion.div>
  )
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={ITEM_VARIANTS} exit="exit" className={className}>
      {children}
    </motion.div>
  )
}
