"use client"

import { forwardRef } from "react"
import { motion, type HTMLMotionProps } from "framer-motion"

export const TAP_SCALE = { scale: 0.96 }
export const TAP_TRANSITION = { duration: 0.12 }

export const PressFeedback = forwardRef<HTMLButtonElement, HTMLMotionProps<"button">>(
  function PressFeedback({ children, ...props }, ref) {
    return (
      <motion.button ref={ref} whileTap={TAP_SCALE} transition={TAP_TRANSITION} {...props}>
        {children}
      </motion.button>
    )
  }
)
