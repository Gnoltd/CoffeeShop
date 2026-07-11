"use client"

import { motion } from "framer-motion"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export type ProgressStep = {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

export function StepProgress({ steps, currentStep }: { steps: ProgressStep[]; currentStep: number }) {
  const progressPercent = currentStep < 0 ? 0 : (currentStep / (steps.length - 1)) * 100

  return (
    <div className="relative flex items-start justify-between">
      <div className="absolute top-5 left-0 -z-0 h-1 w-full bg-border" />
      <motion.div
        className="absolute top-5 left-0 -z-0 h-1 bg-primary"
        initial={false}
        animate={{ width: `${progressPercent}%` }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      />
      {steps.map((step, index) => {
        const Icon = step.icon
        const isDone = index < currentStep
        const isCurrent = index === currentStep
        return (
          <div key={step.key} className="z-10 flex w-1/4 flex-col items-center gap-2">
            <motion.div
              animate={{ scale: isCurrent ? 1 : 0.92 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className={cn(
                "nb-border-sm flex h-10 w-10 items-center justify-center rounded-full",
                isDone && "bg-success text-primary-foreground",
                isCurrent && "bg-primary text-primary-foreground",
                !isDone && !isCurrent && "bg-chip text-muted-foreground"
              )}
            >
              {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </motion.div>
            <p
              className={cn(
                "text-center text-[10px] font-extrabold leading-tight",
                isDone || isCurrent ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {step.label}
            </p>
          </div>
        )
      })}
    </div>
  )
}
