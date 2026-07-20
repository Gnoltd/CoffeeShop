"use client"

import { useEffect, useRef, useState } from "react"
import { QrCode } from "lucide-react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { SPOTLIGHT_R, spotlightMask } from "@/lib/spotlight-mask"

// Phone viewports get a 40% smaller reveal radius — the 260px desktop default
// (tuned for mouse-cursor use) covers more than half the width of a phone
// screen and swallows the whole reveal image at rest.
const MOBILE_SPOTLIGHT_R = SPOTLIGHT_R * 0.6
const MOBILE_BREAKPOINT = 640

// Swappable hero photography (CSS backgrounds, no next/image config needed).
// Base: dark moody coffee; reveal: warm glowing cup, shown through the spotlight.
const BASE_IMAGE =
  "https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1600&q=80"
const REVEAL_IMAGE =
  "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1600&q=80"

export function SpotlightHero({ onScanQr }: { onScanQr: () => void }) {
  const t = useTranslations("Landing")
  const mouse = useRef({ x: 0, y: 0 })
  const smooth = useRef({ x: 0, y: 0 })
  const rafRef = useRef(0)
  const [cursorPos, setCursorPos] = useState({ x: -999, y: -999 })
  const [radius, setRadius] = useState(SPOTLIGHT_R)

  useEffect(() => {
    // Start at screen center so touch devices see the reveal immediately.
    const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    mouse.current = { ...center }
    smooth.current = { ...center }
    setCursorPos(center)

    const updateRadius = () => {
      setRadius(window.innerWidth < MOBILE_BREAKPOINT ? MOBILE_SPOTLIGHT_R : SPOTLIGHT_R)
    }
    updateRadius()
    window.addEventListener("resize", updateRadius)

    const onMouseMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY }
    }
    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (touch) mouse.current = { x: touch.clientX, y: touch.clientY }
    }
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("touchmove", onTouchMove, { passive: true })

    const tick = () => {
      smooth.current.x += (mouse.current.x - smooth.current.x) * 0.1
      smooth.current.y += (mouse.current.y - smooth.current.y) * 0.1
      setCursorPos({ x: smooth.current.x, y: smooth.current.y })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener("resize", updateRadius)
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("touchmove", onTouchMove)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const mask = spotlightMask(cursorPos.x, cursorPos.y, radius)

  return (
    <section
      className="relative h-screen w-full overflow-hidden bg-black"
      style={{ height: "100dvh" }}
    >
      <div
        className="hero-zoom absolute inset-0 z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${BASE_IMAGE})` }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-30 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${REVEAL_IMAGE})`,
          maskImage: mask,
          WebkitMaskImage: mask,
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-40 h-28 bg-gradient-to-t from-background to-transparent"
        aria-hidden
      />
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 px-6 text-center sm:gap-8">
        <h1 className="leading-[0.95] text-white">
          <span
            className="hero-anim hero-reveal font-playfair block text-5xl font-normal italic sm:text-7xl md:text-8xl"
            style={{ letterSpacing: "-0.05em", animationDelay: "0.25s" }}
          >
            {t("heroLine1")}
          </span>
          <span
            className="hero-anim hero-reveal -mt-1 block text-5xl font-normal sm:text-7xl md:text-8xl"
            style={{ letterSpacing: "-0.08em", animationDelay: "0.42s" }}
          >
            {t("heroLine2")}
          </span>
        </h1>
        <div
          className="hero-anim hero-fade flex max-w-sm flex-col gap-2 sm:max-w-md"
          style={{ animationDelay: "0.6s" }}
        >
          <p className="hidden text-sm leading-relaxed text-white/80 sm:block sm:text-base">
            {t("heroLeftText")}
          </p>
          <p className="text-sm leading-relaxed text-white/80 sm:text-base">{t("heroRightText")}</p>
        </div>
        <div
          className="hero-anim hero-fade flex w-full max-w-xs flex-col items-center gap-4"
          style={{ animationDelay: "0.85s" }}
        >
          <Link
            href="/menu"
            className="w-full rounded-full bg-primary px-7 py-3 text-sm font-medium text-primary-foreground transition-all hover:scale-[1.03] hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/30 active:scale-95"
          >
            {t("orderNow")}
          </Link>
          <button
            type="button"
            onClick={onScanQr}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-white/70 px-7 py-3 text-sm font-medium text-white transition-all hover:scale-[1.03] hover:bg-white/10 active:scale-95"
          >
            <QrCode className="h-4 w-4" aria-hidden />
            {t("scanQr")}
          </button>
        </div>
      </div>
    </section>
  )
}
