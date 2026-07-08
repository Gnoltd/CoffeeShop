"use client"

import { useEffect } from "react"
import { animate, motion, useMotionValue, useTransform } from "framer-motion"

export function AnimatedCounter({
  value,
  format,
  className,
}: {
  value: number
  format: (n: number) => string
  className?: string
}) {
  const motionValue = useMotionValue(value)
  const display = useTransform(motionValue, (v) => format(Math.round(v)))

  useEffect(() => {
    const controls = animate(motionValue, value, { duration: 0.4, ease: [0.16, 1, 0.3, 1] })
    return controls.stop
  }, [value, motionValue])

  return <motion.span className={className}>{display}</motion.span>
}
