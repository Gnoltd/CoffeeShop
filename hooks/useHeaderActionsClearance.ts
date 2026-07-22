"use client"

import { useEffect, useState } from "react"

const GAP_PX = 16
// Safe upper-bound guess for header-actions-stack's width (role badge +
// theme toggle + language switcher) used only until the real width is
// measured on mount — avoids a flash of overlap on first paint.
const FALLBACK_CLEARANCE_PX = 280

/** Measures #header-actions-stack's real rendered width so a header can reserve exactly that much space instead of guessing. */
export function useHeaderActionsClearance(elementId = "header-actions-stack") {
  const [clearance, setClearance] = useState(FALLBACK_CLEARANCE_PX)

  useEffect(() => {
    const el = document.getElementById(elementId)
    if (!el) return

    const update = () => setClearance(el.getBoundingClientRect().width + GAP_PX)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [elementId])

  return clearance
}
