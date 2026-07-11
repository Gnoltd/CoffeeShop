"use client"

import { useEffect, useState } from "react"

/**
 * Returns `true` when the viewport matches `min-width: 768px` (Tailwind `md:` breakpoint).
 * Uses `matchMedia` — a single event listener, no resize polling.
 */
export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)")
    setIsDesktop(mql.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [])

  return isDesktop
}
