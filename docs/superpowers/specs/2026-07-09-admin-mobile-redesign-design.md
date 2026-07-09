# Admin Mobile Redesign: Hamburger Drawer — Design

## Problem

Admin is laptop/PC-only, the last of three sub-projects making staff/
admin surfaces phone-adaptable (POS and KDS both shipped — see
`docs/superpowers/specs/2026-07-09-pos-mobile-redesign-design.md` and
`docs/superpowers/specs/2026-07-09-kds-mobile-redesign-design.md`).
`app/[locale]/admin/layout.tsx` renders `AdminSidebar` as a fixed
`w-64` `<aside>` with no responsive treatment at all — 9 links total
(7 `NAV_ITEMS` + 2 `FULFILLMENT_NAV_ITEMS`), too many for a 5-slot
`BottomNav` (the customer side's mobile pattern), which is why the
locked design is a slide-out hamburger drawer instead.

Unlike POS/KDS, most of Admin's actual page *content* is already
mobile-reasonable: `dashboard-view.tsx`'s KPI grid
(`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`) and every other section
on that page already stack to a single column below `sm` (640px) —
confirmed by reading the full file, not assumed. `menu-management.tsx`,
`tables-management.tsx`, `staff-accounts.tsx`, and
`food-cost-calculator.tsx` already use `overflow-x-auto` table
wrappers and `grid-cols-1`-base responsive grids (CLAUDE.md's
cross-cutting conventions already note some of this). The real,
sole layout blocker is the sidebar itself.

## Goals

1. Below `md`, `AdminSidebar` becomes a slide-out drawer (scrim +
   spring-animated panel sliding in from the left, swipe-to-dismiss),
   triggered by a hamburger button in a new lightweight mobile-only
   header. At/above `md`, the sidebar is pixel-identical to today's
   fixed `<aside>`.
2. Tapping a nav link inside the open drawer both navigates and closes
   the drawer (no leftover open overlay after navigation).
3. The new mobile header doesn't collide with the global fixed
   `RoleBadge`+`LanguageSwitcher` pill cluster
   (`app/[locale]/layout.tsx:64-67`) — the same cluster that took 4
   live-verification iterations to clear in the KDS redesign (see
   `daily.md` for that lesson: neither margin nor padding fixes an
   overlap if content already has no slack; the fix is keeping content
   narrow enough to begin with). This header is left-aligned only (no
   right-side content competing for the same horizontal space), so it
   should be inherently safe, but gets the same live pixel-measurement
   verification as KDS rather than assumed.

## Non-goals

- **No changes to any admin page's own content grid** — `dashboard-view.tsx`,
  `menu-management.tsx`, `tables-management.tsx`, `staff-accounts.tsx`,
  `food-cost-calculator.tsx` already stack correctly below their
  existing breakpoints (verified by reading each file, not assumed).
  The locked decision's "KPI cards stack vertically instead of
  desktop's grid" is already true in the current code — this redesign
  doesn't need to (and doesn't) touch `dashboard-view.tsx` at all.
- POS or KDS — both already shipped.
- A real Stitch-generated mockup — abandoned project-wide (see
  `daily.md`'s Stitch dead-end writeup).
- Any change to the customer-side `BottomNav` or its 5-slot pattern —
  irrelevant here; Admin explicitly needs a drawer *because* it has
  too many links for that pattern (Goal 1's premise).

## Design

### 1. New primitive: `components/motion/side-drawer.tsx`

No existing left-side drawer/off-canvas primitive exists in this repo
— `components/motion/bottom-sheet.tsx` is the closest precedent (a
Starbucks-motion primitive: scrim + spring-animated panel,
drag-to-dismiss). `SideDrawer` mirrors its exact structure and spring
constants (`stiffness: 380, damping: 32`, matching `BottomSheet`
exactly for a consistent feel across every overlay in the app),
axis-flipped from vertical to horizontal and anchored left instead of
bottom:

```tsx
"use client"

import { AnimatePresence, motion, type PanInfo } from "framer-motion"

export function SideDrawer({
  onClose,
  children,
}: {
  onClose: () => void
  children: React.ReactNode
}) {
  function handleDragEnd(_event: unknown, info: PanInfo) {
    if (info.offset.x < -80 || info.velocity.x < -500) onClose()
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-stretch justify-start bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="flex h-full w-72 max-w-[80vw] flex-col overflow-hidden bg-card shadow-xl"
          initial={{ x: "-100%" }}
          animate={{ x: 0 }}
          exit={{ x: "-100%" }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={{ left: 0.5, right: 0 }}
          onDragEnd={handleDragEnd}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
```

`w-72 max-w-[80vw]` keeps the panel narrower than the full screen (a
drawer, not a takeover) while never exceeding 80% of viewport width on
very narrow phones. Swiping left past 80px or with enough velocity
dismisses it, same threshold philosophy as `BottomSheet`'s downward
swipe.

### 2. `admin-sidebar.tsx`: shared nav content, two render targets

Same extraction pattern as POS's `OrderPanel` and KDS's `active` prop
— the nav markup (brand link + both `<nav>` lists) becomes a local
`AdminNavContent` component, rendered once inside the always-desktop
`<aside>` (now `hidden md:flex`) and once inside the drawer when open.
An optional `onNavigate` prop lets the drawer close itself the instant
a link is tapped:

```tsx
function AdminNavContent({ onNavigate }: { onNavigate?: () => void }) {
  // same brand Link + NAV_ITEMS.map + FULFILLMENT_NAV_ITEMS.map as today,
  // each Link gets onClick={onNavigate} added
}

export function AdminSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto border-r bg-card py-4 md:flex">
        <AdminNavContent />
      </aside>
      {open && (
        <SideDrawer onClose={onClose}>
          <div className="flex h-full flex-col overflow-y-auto py-4">
            <AdminNavContent onNavigate={onClose} />
          </div>
        </SideDrawer>
      )}
    </>
  )
}
```

`AdminSidebar`'s signature changes from no-args to `{ open, onClose }`
— its one call site (`admin/layout.tsx`) updates accordingly.

### 3. New `components/admin/admin-mobile-header.tsx`

Admin has no dedicated top-bar component today (unlike KDS's
`kitchen-top-bar.tsx`) — the brand logo lives inside the sidebar
itself, which disappears off-canvas on mobile. A small `md:hidden`
header replaces it, left-aligned only (hamburger + brand, no
right-side content) so it can't repeat the KDS top-bar's overlap
problem:

```tsx
"use client"

import { useTranslations } from "next-intl"
import { Coffee, Menu } from "lucide-react"
import { Link } from "@/i18n/navigation"

export function AdminMobileHeader({ onOpenMenu }: { onOpenMenu: () => void }) {
  const tBrand = useTranslations("Brand")
  const tNav = useTranslations("Nav")

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4 md:hidden">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label={tNav("openMenu")}
        className="rounded-lg p-2 text-card-foreground transition-colors hover:bg-muted"
      >
        <Menu className="h-5 w-5" />
      </button>
      <Link href="/" className="flex items-center gap-2 font-bold text-primary">
        <Coffee className="h-5 w-5" />
        {tBrand("name")}
      </Link>
    </header>
  )
}
```

### 4. `admin/layout.tsx`: lifts drawer-open state, switches direction by breakpoint

Becomes a client component (adds `"use client"`) to hold
`isDrawerOpen` state, shared between the header (which opens it) and
the sidebar (which renders it). The outer container switches from a
row to a column below `md`, since mobile stacks the new header above
`main` instead of placing a sidebar beside it:

```tsx
"use client"

import { useState } from "react"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { AdminMobileHeader } from "@/components/admin/admin-mobile-header"
import { InventoryProvider } from "@/hooks/useInventory"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  return (
    <InventoryProvider>
      <div className="flex h-screen flex-col overflow-hidden md:flex-row">
        <AdminMobileHeader onOpenMenu={() => setIsDrawerOpen(true)} />
        <AdminSidebar open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-6 md:pt-16">{children}</main>
      </div>
    </InventoryProvider>
  )
}
```

`pt-16` (the fixed-badge clearance) moves from unconditional to
`md:pt-16` — on mobile, `AdminMobileHeader`'s own `h-14` already pushes
`main`'s content below the badge cluster's vertical span, so the extra
64px was redundant screen-space waste on top of that, not a second
collision needing its own fix (unlike KDS's top bar, which had to
reserve *horizontal* space in a shared row rather than simply
occupying vertical space above the content it's clearing).

### 5. Translations

One new key, `Nav.openMenu` (both `messages/en.json`/`vi.json`) — the
hamburger button's aria-label. No explicit in-drawer close button
(matching `BottomSheet`'s own UX exactly: tap the scrim, or swipe, to
dismiss — no redundant "X" button), so no `closeMenu` key needed.

### 6. Testing

Frontend-only, no schema/RPC changes — verified live per this
project's convention (same temporary/not-committed Playwright approach
as POS and KDS): confirm the desktop fixed sidebar is pixel-unchanged
≥`md` (no mobile header visible, no drawer-open button); at phone
width, confirm the hamburger opens the drawer with a slide+scrim
animation, confirm the drawer shows all 9 links, confirm tapping a
link navigates AND closes the drawer, confirm swiping the drawer left
dismisses it, confirm tapping the scrim dismisses it. Explicitly
re-verify the mobile header doesn't collide with the fixed
`RoleBadge`+`LanguageSwitcher` cluster via exact `getBoundingClientRect()`
measurement (not just a screenshot glance), learning directly from the
KDS session's 4-iteration miss. Also spot-check that
`dashboard-view.tsx`'s content renders correctly at phone width once
it has full-width `main` (confirming the Non-goals section's claim
that no code changes were needed there, not just assuming it).

## Open questions resolved during brainstorming (prior sessions)

- **Hamburger drawer over any other collapse strategy** for Admin
  specifically (as opposed to POS's page-swap or KDS's segmented
  control) — locked in during the pre-Stitch brainstorming session
  recorded in `daily.md`, explicitly reasoned as necessary because 7
  sections exceed a 5-slot `BottomNav`.
- **Dashboard KPI cards stack vertically** — locked in from that same
  session; this design confirms (rather than re-decides) that the
  existing `grid-cols-1` base already satisfies it, so no dashboard
  code changes are part of this plan.
- **Reuse `BottomSheet`'s conventions for the new `SideDrawer`** — not
  an explicit prior brainstorming decision (Admin's brainstorming
  predates the Starbucks-motion primitives even existing), but a
  natural consequence of this session's now-established pattern
  (POS reused `RouteTransition`'s timing constants; KDS reused
  `SegmentedControl` outright) — consistency across the whole
  mobile-redesign effort, not a new design direction.
