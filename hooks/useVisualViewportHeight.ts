"use client"

import { useEffect, useState } from "react"

/**
 * Tracks window.visualViewport's real height in pixels, which shrinks when
 * the on-screen keyboard opens on both iOS Safari and Android Chrome —
 * unlike CSS dvh/the interactive-widget viewport meta, which iOS Safari
 * doesn't reliably honor for `position: fixed` elements. Returns null
 * before the first measurement (SSR, or no visualViewport support), so
 * callers should fall back to a CSS height class until a number arrives.
 */
export function useVisualViewportHeight() {
  const [height, setHeight] = useState<number | null>(null)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const update = () => setHeight(vv.height)
    update()
    vv.addEventListener("resize", update)
    vv.addEventListener("scroll", update)
    return () => {
      vv.removeEventListener("resize", update)
      vv.removeEventListener("scroll", update)
    }
  }, [])

  return height
}
