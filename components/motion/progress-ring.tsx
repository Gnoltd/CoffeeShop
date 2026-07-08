"use client"

import { motion } from "framer-motion"

export function ProgressRing({
  percent,
  size = 96,
  strokeWidth = 8,
  className,
  children,
}: {
  percent: number
  size?: number
  strokeWidth?: number
  className?: string
  children?: React.ReactNode
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <div className={className} style={{ width: size, height: size, position: "relative" }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} className="fill-none stroke-muted" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="fill-none stroke-accent"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: circumference * (1 - percent / 100) }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  )
}
