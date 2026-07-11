# Neubrutalist Modern Redesign — Phase 2 (Cart, Checkout, Orders, Profile, Loyalty) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin Cart, Checkout, Order Tracking, Order History, Profile, and Loyalty to the Neubrutalist Modern system established in Phase 1, and fix `StepProgress` (used only by Order Tracking) so a completed step shows a green checkmark instead of keeping its own icon — the behavior approved during mockup review that the current shared component doesn't yet do.

**Architecture:** Six real customer pages get their card/section containers, buttons, and badges switched to the `nb-border`/`nb-shadow`/`nb-press` classes and `neubrutal` Button/Badge variant from Phase 1 — same mechanical substitution pattern proven there (`rounded-xl border bg-card ... shadow-sm` → `nb-border nb-shadow rounded-xl bg-card`, `hover:` affordances → `nb-press`). One shared primitive, `components/motion/step-progress.tsx`, gains a `isDone` branch that swaps to a checkmark icon. **Correction from the mockup-review session**: the mockups used a tab-switcher to show Cart+Checkout and Orders-Tracking+History and Profile+Loyalty as pairs for easy side-by-side review in one HTML file — that was a review convenience, not a real navigation change. All six pages stay separate routes exactly as they are today (`/cart`, `/checkout`, `/orders/[orderId]`, `/orders`, `/profile`, `/loyalty`), per the design spec's own "No route/IA changes" constraint.

**Tech Stack:** Next.js App Router, React 19, Tailwind v4, existing `framer-motion`/`lucide-react` — no new dependency.

## Global Constraints

- No backend/RPC/schema changes, no route/IA changes — presentational only.
- Every card/button/badge substitution follows the exact Phase 1 pattern: a container with `rounded-* border bg-card ... shadow-sm` becomes `nb-border nb-shadow rounded-* bg-card` (drop `shadow-sm`, drop the bare `border` utility since `nb-border` supplies both width and color); a tappable card/link additionally gets `nb-press`; prices get `text-price font-extrabold` in place of `text-primary font-bold`; badges/pills get `nb-border-sm nb-shadow-sm`. Any container in the six files below matching this exact pattern that isn't individually called out in a task's steps still gets this same substitution — it's a mechanical, one-to-one rule, not a judgment call.
- Do not touch `hooks/useCart.tsx`, `hooks/useOrders.tsx`, `hooks/useTables.tsx`, or any `lib/supabase/*.ts` call — every task in this plan only changes `className` strings and, in Task 1 only, adds a new conditional render branch to `StepProgress` (no prop-shape change, so its one call site in `order-tracking.tsx` needs no changes beyond the re-skin already planned for that file).
- Verification: `npx tsc --noEmit` + `npm test` after every task (this sandbox cannot run `next build` — no internet access to fetch Google Fonts, confirmed unrelated to app code in Phase 1). Live verification on Vercel is deferred by explicit user request for this phase too; push happens at the end same as Phase 1.

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `components/motion/step-progress.tsx` | Modify | Add checkmark-on-done behavior; re-skin the step dots to Neubrutalist |
| `components/customer/cart-view.tsx` | Modify | Re-skin `CartRow`, promo section, summary panel; checkout CTA → `neubrutal` Button |
| `components/customer/checkout-view.tsx` | Modify | Re-skin order-type/loyalty/rewards sections, payment-method picker, summary panel, desktop card + mobile fixed bar |
| `components/customer/order-tracking.tsx` | Modify | Re-skin status hero, `StepProgress` section wrapper, payment-method picker, order-type/branch badges, order-details items list, summary section |
| `components/customer/order-history.tsx` | Modify | Re-skin order rows, status badges |
| `components/customer/profile-view.tsx` | Modify | Re-skin avatar section, editable fields, nav-link menu rows |
| `components/customer/loyalty-view.tsx` | Modify | Re-skin balance card, tier card, rewards CTA, transaction rows |

---

### Task 1: Fix `StepProgress` — checkmark on done, Neubrutalist re-skin

**Files:**
- Modify: `components/motion/step-progress.tsx`

**Interfaces:**
- Consumes: `nb-border`/`nb-shadow-sm`/`--success`/`--ink` tokens (Phase 1).
- Produces: same `StepProgress({ steps, currentStep })` signature as today — no breaking change, so `order-tracking.tsx` (Task 4) only needs its surrounding markup re-skinned, not its `<StepProgress>` call site.

- [ ] **Step 1: Add a `Check` icon import and the done/checkmark branch**

Replace the whole file:

```tsx
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
```

Two behavior changes from the original: `isDone` is now `index < currentStep` (strictly *before* the current step, not `<=`) so the currently-active step shows its own icon in the primary color — exactly the mockup's "Confirmed/Preparing/Ready/Served" pattern where only steps you've *passed* get the checkmark, not the one you're on. `--success` (green) is now used for done steps instead of `--primary` (red/orange), so "completed" and "in progress" are visually distinct colors, not just a filled-vs-empty circle.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm test` — expected: 140 tests pass (no test file covers this presentational component directly, so this confirms no import/type regression elsewhere).

- [ ] **Step 3: Commit**

```bash
git add components/motion/step-progress.tsx
git commit -m "Fix StepProgress: completed steps show a green checkmark, not their own icon re-colored"
```

---

### Task 2: Re-skin `CartView`

**Files:**
- Modify: `components/customer/cart-view.tsx`

- [ ] **Step 1: Re-skin `CartRow` (lines 45-53)**

Replace:

```tsx
    <motion.div
      style={{ x }}
      drag="x"
      dragConstraints={{ left: -96, right: 0 }}
      dragElastic={{ left: 0.15, right: 0 }}
      onDragEnd={handleDragEnd}
      className="flex gap-3 rounded-xl border bg-card p-3 shadow-sm"
    >
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-muted">
```

with:

```tsx
    <motion.div
      style={{ x }}
      drag="x"
      dragConstraints={{ left: -96, right: 0 }}
      dragElastic={{ left: 0.15, right: 0 }}
      onDragEnd={handleDragEnd}
      className="nb-border nb-shadow flex gap-3 rounded-xl bg-card p-3"
    >
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-chip">
```

(No `nb-press` here — this row is draggable for swipe-to-delete, and the shadow-collapse press transform would fight the drag transform on the same element.)

- [ ] **Step 2: Re-skin the price text (line 79)**

Replace:

```tsx
            <span className="font-bold text-primary">
```

with:

```tsx
            <span className="font-extrabold text-price">
```

- [ ] **Step 3: Re-skin the promo-applied/promo-input sections (lines 154-192)**

Replace:

```tsx
          {promoCode ? (
            <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-medium text-accent-foreground">
                <Ticket className="h-4 w-4" />
                {t("promoApplied")}: <strong>{promoCode}</strong>
              </span>
              <button
                type="button"
                onClick={clearPromoCode}
                aria-label={t("removePromo")}
                title={t("removePromo")}
                className="text-accent-foreground/70 hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-2 rounded-xl border border-dashed p-4">
              <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Ticket className="h-4 w-4" />
                {t("promoLabel")}
              </span>
              <div className="flex gap-2">
                <Input
                  value={promoInput}
                  onChange={(e) => {
                    setPromoInput(e.target.value)
                    setPromoError(false)
                  }}
                  placeholder={t("promoPlaceholder")}
                  className="h-10 flex-1"
                />
                <Button variant="outline" className="h-10" onClick={handleApplyPromo} disabled={!promoInput.trim()}>
                  {t("apply")}
                </Button>
              </div>
              {promoError && <p className="text-xs text-destructive">{t("invalidPromo")}</p>}
            </div>
          )}
```

with:

```tsx
          {promoCode ? (
            <div className="nb-border-sm flex items-center justify-between gap-3 rounded-xl bg-chip px-4 py-3 mt-6">
              <span className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Ticket className="h-4 w-4" />
                {t("promoApplied")}: <strong>{promoCode}</strong>
              </span>
              <button
                type="button"
                onClick={clearPromoCode}
                aria-label={t("removePromo")}
                title={t("removePromo")}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="nb-border-sm mt-6 flex flex-col gap-2 rounded-xl bg-card p-4">
              <span className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                <Ticket className="h-4 w-4" />
                {t("promoLabel")}
              </span>
              <div className="flex gap-2">
                <Input
                  value={promoInput}
                  onChange={(e) => {
                    setPromoInput(e.target.value)
                    setPromoError(false)
                  }}
                  placeholder={t("promoPlaceholder")}
                  className="nb-border-sm h-10 flex-1 rounded-lg"
                />
                <Button variant="neubrutal" className="h-10" onClick={handleApplyPromo} disabled={!promoInput.trim()}>
                  {t("apply")}
                </Button>
              </div>
              {promoError && <p className="text-xs text-destructive">{t("invalidPromo")}</p>}
            </div>
          )}
```

- [ ] **Step 4: Re-skin the summary panel and checkout CTA (lines 196-223)**

Replace:

```tsx
        <div className="w-full md:w-80 md:flex-[2] md:sticky md:top-20 md:self-start">
          <section className="space-y-3 rounded-2xl bg-muted p-5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("subtotal")}</span>
              <AnimatedCounter value={subtotal} format={formatVND} className="font-medium" />
            </div>
            {promoDiscount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("discount")}</span>
                <span className="font-medium text-green-600">-{formatVND(promoDiscount)}</span>
              </div>
            )}
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-card-foreground">{t("total")}</span>
              <AnimatedCounter value={total} format={formatVND} className="text-lg font-bold text-primary" />
            </div>
          </section>

          <Button
            className="mt-6 h-12 w-full gap-2 rounded-xl text-base"
            render={<Link href="/checkout" />}
            nativeButton={false}
          >
            {t("proceedToCheckout")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
```

with:

```tsx
        <div className="w-full md:w-80 md:flex-[2] md:sticky md:top-20 md:self-start">
          <section className="nb-border nb-shadow space-y-3 rounded-2xl bg-chip p-5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("subtotal")}</span>
              <AnimatedCounter value={subtotal} format={formatVND} className="font-bold" />
            </div>
            {promoDiscount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("discount")}</span>
                <span className="font-bold text-success">-{formatVND(promoDiscount)}</span>
              </div>
            )}
            <div className="h-0.5 bg-ink/20" />
            <div className="flex items-center justify-between">
              <span className="text-lg font-extrabold text-card-foreground">{t("total")}</span>
              <AnimatedCounter value={total} format={formatVND} className="text-lg font-extrabold text-price" />
            </div>
          </section>

          <Button
            variant="neubrutal"
            className="mt-6 h-12 w-full gap-2 text-base"
            render={<Link href="/checkout" />}
            nativeButton={false}
          >
            {t("proceedToCheckout")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm test` — expected: 140 tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/customer/cart-view.tsx
git commit -m "Re-skin Cart to Neubrutalist Modern"
```

---

### Task 3: Re-skin `CheckoutView`

**Files:**
- Modify: `components/customer/checkout-view.tsx`

- [ ] **Step 1: Re-skin the dine-in table pill and QR-scan prompt (lines 195-209)**

Replace:

```tsx
            {orderType === "dine-in" && activeTable && (
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/20 px-3 py-1.5 text-sm text-accent-foreground">
                <TableIcon className="h-4 w-4" />
                {t("table")}: <strong>{tableNumber}</strong>
              </div>
            )}
            {!activeTable && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-muted-foreground/40 p-3">
                <p className="text-xs text-muted-foreground">{t("dineInRequiresScan")}</p>
                <Button size="sm" variant="outline" className="h-9 shrink-0 gap-1.5" onClick={() => setIsScannerOpen(true)}>
                  <QrCode className="h-3.5 w-3.5" />
                  {t("scanTableQr")}
                </Button>
              </div>
            )}
```

with:

```tsx
            {orderType === "dine-in" && activeTable && (
              <div className="nb-border-sm inline-flex items-center gap-2 rounded-full bg-chip px-3 py-1.5 text-sm font-bold text-foreground">
                <TableIcon className="h-4 w-4" />
                {t("table")}: <strong>{tableNumber}</strong>
              </div>
            )}
            {!activeTable && (
              <div className="nb-border-sm flex items-center justify-between gap-2 rounded-lg bg-card p-3">
                <p className="text-xs text-muted-foreground">{t("dineInRequiresScan")}</p>
                <Button size="sm" variant="neubrutal" className="h-9 shrink-0 gap-1.5" onClick={() => setIsScannerOpen(true)}>
                  <QrCode className="h-3.5 w-3.5" />
                  {t("scanTableQr")}
                </Button>
              </div>
            )}
```

- [ ] **Step 2: Re-skin the loyalty-points section (lines 231-270)**

Replace:

```tsx
            <section className="mb-6 space-y-3 rounded-xl border border-accent/30 bg-accent/10 p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-card-foreground">{t("loyaltyPoints")}</h2>
                <Sparkles className="h-6 w-6 text-accent-foreground/70" />
              </div>
              {isLoggedIn ? (
                <>
                  <p className="text-sm text-muted-foreground">{t("pointsBalance", { points: pointsBalance })}</p>
                  <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
```

with:

```tsx
            <section className="nb-border nb-shadow-sm mb-6 space-y-3 rounded-xl bg-chip p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-extrabold text-card-foreground">{t("loyaltyPoints")}</h2>
                <Sparkles className="h-6 w-6 text-accent-foreground/70" />
              </div>
              {isLoggedIn ? (
                <>
                  <p className="text-sm text-muted-foreground">{t("pointsBalance", { points: pointsBalance })}</p>
                  <div className="nb-border-sm flex items-center justify-between gap-3 rounded-lg bg-card p-3">
```

- [ ] **Step 3: Re-skin the rewards-list section (lines 272-309)**

Replace:

```tsx
            <section className="mb-6 space-y-3 rounded-xl border border-accent/30 bg-accent/10 p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-card-foreground">{t("myRewardsTitle")}</h2>
                <Gift className="h-6 w-6 text-accent-foreground/70" />
              </div>
              <div className="flex flex-col gap-2">
                {usableRedemptions.map((r) => {
                  const selected = selectedRedemptionIds.includes(r.id)
                  const name = locale === "vi" ? r.rewardNameVi : r.rewardNameEn
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggleRedemption(r.id)}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-lg border-2 bg-card p-3 text-left transition-colors",
                        selected ? "border-primary bg-primary/5" : "border-transparent"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                            selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                          )}
                        >
                          {selected && <Check className="h-3 w-3" />}
                        </span>
                        <span className="text-sm font-medium text-card-foreground">{name}</span>
                      </span>
                      <span className="text-sm font-bold text-primary">-{formatVND(r.discountValueVnd)}</span>
                    </button>
                  )
                })}
              </div>
            </section>
```

with:

```tsx
            <section className="nb-border nb-shadow-sm mb-6 space-y-3 rounded-xl bg-chip p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-extrabold text-card-foreground">{t("myRewardsTitle")}</h2>
                <Gift className="h-6 w-6 text-accent-foreground/70" />
              </div>
              <div className="flex flex-col gap-2">
                {usableRedemptions.map((r) => {
                  const selected = selectedRedemptionIds.includes(r.id)
                  const name = locale === "vi" ? r.rewardNameVi : r.rewardNameEn
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggleRedemption(r.id)}
                      className={cn(
                        "nb-border-sm nb-press-sm flex items-center justify-between gap-3 rounded-lg bg-card p-3 text-left",
                        selected && "bg-primary/10"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-ink",
                            selected && "bg-primary text-primary-foreground"
                          )}
                        >
                          {selected && <Check className="h-3 w-3" />}
                        </span>
                        <span className="text-sm font-bold text-card-foreground">{name}</span>
                      </span>
                      <span className="text-sm font-extrabold text-price">-{formatVND(r.discountValueVnd)}</span>
                    </button>
                  )
                })}
              </div>
            </section>
```

- [ ] **Step 4: Re-skin the payment-method picker (lines 325-350)**

Replace:

```tsx
                {PAYMENT_OPTIONS.map(({ id, icon: Icon, labelKey, enabled }) => (
                  <PressFeedback
                    key={id}
                    type="button"
                    disabled={!enabled}
                    title={enabled ? undefined : t("paymentMethodComingSoon")}
                    onClick={() => setPaymentMethod(id)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors",
                      paymentMethod === id
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-transparent bg-muted text-muted-foreground",
                      !enabled && "opacity-50"
                    )}
                  >
                    <Icon className="h-7 w-7" />
                    <span className="text-xs font-bold">{t(labelKey)}</span>
                  </PressFeedback>
                ))}
```

with:

```tsx
                {PAYMENT_OPTIONS.map(({ id, icon: Icon, labelKey, enabled }) => (
                  <PressFeedback
                    key={id}
                    type="button"
                    disabled={!enabled}
                    title={enabled ? undefined : t("paymentMethodComingSoon")}
                    onClick={() => setPaymentMethod(id)}
                    className={cn(
                      "nb-border nb-shadow-sm flex flex-col items-center gap-2 rounded-xl p-4",
                      paymentMethod === id
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground",
                      !enabled && "opacity-50"
                    )}
                  >
                    <Icon className="h-7 w-7" />
                    <span className="text-xs font-extrabold">{t(labelKey)}</span>
                  </PressFeedback>
                ))}
```

- [ ] **Step 5: Re-skin the summary panel and desktop/mobile Place Order actions (lines 355-451)**

Replace:

```tsx
          <section className="mb-6 space-y-3 rounded-xl border bg-muted p-4">
            <h2 className="font-bold text-card-foreground">{t("summary")}</h2>
```

with:

```tsx
          <section className="nb-border nb-shadow-sm mb-6 space-y-3 rounded-xl bg-chip p-4">
            <h2 className="font-extrabold text-card-foreground">{t("summary")}</h2>
```

Replace:

```tsx
          <div className="hidden md:flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">{t("total")}</span>
              <span className="text-2xl font-bold text-primary">{formatVND(total)}</span>
              {discount > 0 && (redeemLoyalty || redemptionDiscount > 0) && (
                <span className="text-[11px] text-accent-foreground/80 mt-1">
                  {t("discountApplied", { amount: formatVND(discount) })}
                </span>
              )}
            </div>
            <Button
              onClick={handlePlaceOrder}
              disabled={(payAt === "now" && !paymentMethod) || (orderType === "dine-in" && !activeTable) || isPlacing}
              className="h-12 w-full rounded-xl text-base font-bold"
            >
              {t("placeOrder")}
            </Button>
          </div>
```

with:

```tsx
          <div className="nb-border nb-shadow hidden md:flex flex-col gap-4 rounded-xl bg-card p-5">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">{t("total")}</span>
              <span className="text-2xl font-extrabold text-price">{formatVND(total)}</span>
              {discount > 0 && (redeemLoyalty || redemptionDiscount > 0) && (
                <span className="text-[11px] text-accent-foreground/80 mt-1">
                  {t("discountApplied", { amount: formatVND(discount) })}
                </span>
              )}
            </div>
            <Button
              variant="neubrutal"
              onClick={handlePlaceOrder}
              disabled={(payAt === "now" && !paymentMethod) || (orderType === "dine-in" && !activeTable) || isPlacing}
              className="h-12 w-full text-base"
            >
              {t("placeOrder")}
            </Button>
          </div>
```

Replace the mobile fixed bar's button (keep the surrounding `<div>` classes as-is — that bar is fixed/full-width chrome, not a card, and doesn't get `nb-border`/`nb-shadow`):

```tsx
        <Button
          onClick={handlePlaceOrder}
          disabled={(payAt === "now" && !paymentMethod) || (orderType === "dine-in" && !activeTable) || isPlacing}
          className="h-12 rounded-xl px-8 text-base font-bold"
        >
          {t("placeOrder")}
        </Button>
      </div>
```

with:

```tsx
        <Button
          variant="neubrutal"
          onClick={handlePlaceOrder}
          disabled={(payAt === "now" && !paymentMethod) || (orderType === "dine-in" && !activeTable) || isPlacing}
          className="h-12 px-8 text-base"
        >
          {t("placeOrder")}
        </Button>
      </div>
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm test` — expected: 140 tests pass.

- [ ] **Step 7: Commit**

```bash
git add components/customer/checkout-view.tsx
git commit -m "Re-skin Checkout to Neubrutalist Modern"
```

---

### Task 4: Re-skin `OrderTracking`

**Files:**
- Modify: `components/customer/order-tracking.tsx`

**Interfaces:**
- Consumes: Task 1's updated `StepProgress` (no call-site changes needed — same props).

- [ ] **Step 1: Re-skin the status hero card (lines 196-201)**

Replace:

```tsx
          <section className="relative overflow-hidden rounded-xl border bg-muted p-6 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-secondary">{t("orderId")}</p>
            <h2 className="mb-4 text-3xl font-bold text-primary">#{formatOrderId(order.id)}</h2>
            <div className="mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-primary/15">
```

with:

```tsx
          <section className="nb-border nb-shadow relative overflow-hidden rounded-xl bg-chip p-6 text-center">
            <p className="text-xs font-extrabold uppercase tracking-widest text-secondary">{t("orderId")}</p>
            <h2 className="mb-4 text-3xl font-extrabold text-price">#{formatOrderId(order.id)}</h2>
            <div className="nb-border-sm mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-primary/15">
```

- [ ] **Step 2: Re-skin the payment-method picker (lines 220-283)**

Replace:

```tsx
            <section className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
```

with:

```tsx
            <section className="nb-border nb-shadow-sm mt-6 rounded-xl bg-chip p-4 text-center">
```

Replace each of the three `PressFeedback` payment-choice buttons' `className`:

```tsx
                      className="flex flex-col items-center gap-2 rounded-xl border-2 border-transparent bg-muted p-4 text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
```

with (same string, three occurrences — one per Cash/Card/VNPay button):

```tsx
                      className="nb-border nb-shadow-sm flex flex-col items-center gap-2 rounded-xl bg-card p-4 text-muted-foreground disabled:opacity-50"
```

Replace the "Pay Now" button:

```tsx
                  <Button className="h-11 w-full rounded-xl" disabled={isPaying} onClick={() => paymentMethod && handlePayNow(paymentMethod)}>
```

with:

```tsx
                  <Button variant="neubrutal" className="h-11 w-full" disabled={isPaying} onClick={() => paymentMethod && handlePayNow(paymentMethod)}>
```

- [ ] **Step 3: Re-skin the order-type/branch badge cards (lines 286-308)**

Replace both occurrences of:

```tsx
            <div className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm">
```

with:

```tsx
            <div className="nb-border nb-shadow-sm flex items-center gap-4 rounded-xl bg-card p-4">
```

- [ ] **Step 4: Re-skin the order-details items list (lines 320-330)**

Replace:

```tsx
                <div key={index} className="rounded-xl border bg-card p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-bold text-card-foreground text-sm">
                        {item.quantity}x {locale === "vi" ? item.nameVi : item.nameEn}
                      </h5>
                      {item.note && <p className="text-xs italic text-accent-foreground">+ {item.note}</p>}
                    </div>
                    <span className="text-sm font-bold text-primary shrink-0">{formatVND(item.unitPrice * item.quantity)}</span>
                  </div>
```

with:

```tsx
                <div key={index} className="nb-border-sm rounded-xl bg-card p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-bold text-card-foreground text-sm">
                        {item.quantity}x {locale === "vi" ? item.nameVi : item.nameEn}
                      </h5>
                      {item.note && <p className="text-xs italic text-accent-foreground">+ {item.note}</p>}
                    </div>
                    <span className="text-sm font-extrabold text-price shrink-0">{formatVND(item.unitPrice * item.quantity)}</span>
                  </div>
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm test` — expected: 140 tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/customer/order-tracking.tsx
git commit -m "Re-skin Order Tracking to Neubrutalist Modern"
```

---

### Task 5: Re-skin `OrderHistory`

**Files:**
- Modify: `components/customer/order-history.tsx`

- [ ] **Step 1: Re-skin the order row card and status badge (lines 89-113)**

Replace:

```tsx
                <Link
                  href={`/orders/${order.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:shadow-md"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-card-foreground">#{formatOrderId(order.id)}</span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold",
                          STATUS_STYLES[order.status]
                        )}
                      >
                        {t(STATUS_KEYS[order.status])}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{formatOrderDate(order.createdAt, locale)}</p>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {t("itemCount", { count: order.items.length })}: {itemsLabel}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-bold text-primary">{formatVND(order.total)}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
```

with:

```tsx
                <Link
                  href={`/orders/${order.id}`}
                  className="nb-border nb-shadow nb-press flex items-center justify-between gap-3 rounded-xl bg-card p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-card-foreground">#{formatOrderId(order.id)}</span>
                      <span
                        className={cn(
                          "nb-border-sm shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold",
                          STATUS_STYLES[order.status]
                        )}
                      >
                        {t(STATUS_KEYS[order.status])}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{formatOrderDate(order.createdAt, locale)}</p>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {t("itemCount", { count: order.items.length })}: {itemsLabel}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-extrabold text-price">{formatVND(order.total)}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm test` — expected: 140 tests pass.

- [ ] **Step 3: Commit**

```bash
git add components/customer/order-history.tsx
git commit -m "Re-skin Order History to Neubrutalist Modern"
```

---

### Task 6: Re-skin `ProfileView`

**Files:**
- Modify: `components/customer/profile-view.tsx`

- [ ] **Step 1: Re-skin the avatar section (lines 117-129)**

Replace:

```tsx
              <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-muted bg-muted">
                <User className="h-12 w-12 text-muted-foreground" />
              </div>
              <button
                type="button"
                disabled
                title="Not implemented yet — no avatar upload backend"
                className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-70 shadow-lg"
              >
```

with:

```tsx
              <div className="nb-border flex h-28 w-28 items-center justify-center rounded-full bg-chip">
                <User className="h-12 w-12 text-muted-foreground" />
              </div>
              <button
                type="button"
                disabled
                title="Not implemented yet — no avatar upload backend"
                className="nb-border-sm absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-70"
              >
```

- [ ] **Step 2: Re-skin the editable field rows (lines 174-223)**

Replace:

```tsx
                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit()
                          if (e.key === "Escape") cancelEdit()
                        }}
                        className="h-11 flex-1 rounded-xl border-2 border-primary bg-card px-4 text-card-foreground focus:outline-none"
                      />
                      <PressFeedback
                        type="button"
                        onClick={saveEdit}
                        aria-label={t("save")}
                        title={t("save")}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"
                      >
                        <Check className="h-4 w-4" />
                      </PressFeedback>
                      <PressFeedback
                        type="button"
                        onClick={cancelEdit}
                        aria-label={t("cancel")}
                        title={t("cancel")}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-muted-foreground"
                      >
                        <X className="h-4 w-4" />
                      </PressFeedback>
                    </div>
                  ) : (
                    <PressFeedback
                      type="button"
                      onClick={() => startEdit(field)}
                      className="flex h-11 w-full items-center justify-between rounded-xl border-2 border-transparent bg-muted px-4 text-left transition-colors hover:border-primary/40"
                    >
                      <span className="text-card-foreground">{profile[field]}</span>
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </PressFeedback>
                  )}
                </div>
              )
            })}
            <div>
              <label className="mb-1 block px-1 text-xs font-medium text-muted-foreground">{t("email")}</label>
              <div className="flex h-11 w-full items-center rounded-xl bg-muted px-4">
```

with:

```tsx
                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit()
                          if (e.key === "Escape") cancelEdit()
                        }}
                        className="nb-border h-11 flex-1 rounded-xl bg-card px-4 text-card-foreground focus:outline-none"
                      />
                      <PressFeedback
                        type="button"
                        onClick={saveEdit}
                        aria-label={t("save")}
                        title={t("save")}
                        className="nb-border-sm flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"
                      >
                        <Check className="h-4 w-4" />
                      </PressFeedback>
                      <PressFeedback
                        type="button"
                        onClick={cancelEdit}
                        aria-label={t("cancel")}
                        title={t("cancel")}
                        className="nb-border-sm flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card text-muted-foreground"
                      >
                        <X className="h-4 w-4" />
                      </PressFeedback>
                    </div>
                  ) : (
                    <PressFeedback
                      type="button"
                      onClick={() => startEdit(field)}
                      className="nb-border flex h-11 w-full items-center justify-between rounded-xl bg-card px-4 text-left"
                    >
                      <span className="text-card-foreground">{profile[field]}</span>
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </PressFeedback>
                  )}
                </div>
              )
            })}
            <div>
              <label className="mb-1 block px-1 text-xs font-medium text-muted-foreground">{t("email")}</label>
              <div className="nb-border-sm flex h-11 w-full items-center rounded-xl bg-chip px-4">
```

- [ ] **Step 3: Re-skin the nav-link menu card (lines 229-316)**

Replace the opening of the menu card:

```tsx
          <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
```

with:

```tsx
          <section className="nb-border nb-shadow overflow-hidden rounded-2xl bg-card">
```

Replace every occurrence (5 total: Order History, Loyalty, Addresses, Language, Settings links, plus the Logout button) of the row hover-affordance class fragment `border-b p-4 transition-colors hover:bg-muted` with `border-b-2 border-ink/15 p-4` (drop the hover-background — Neubrutalist rows don't need a hover background since the row's own press feedback isn't applicable to a full-width nav row the way it is on a card; the border already separates rows clearly), and the final row (`w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted` on the Logout `PressFeedback`) to `w-full items-center justify-between p-4 text-left` (same reasoning — `PressFeedback`'s own `whileTap` already provides feedback, dropping the redundant hover state that doesn't fire on touch anyway).

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm test` — expected: 140 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/customer/profile-view.tsx
git commit -m "Re-skin Profile to Neubrutalist Modern"
```

---

### Task 7: Re-skin `LoyaltyView`

**Files:**
- Modify: `components/customer/loyalty-view.tsx`

- [ ] **Step 1: Re-skin the balance card (lines 61-82)**

Replace:

```tsx
          <section className="rounded-xl border bg-muted p-5 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-primary">
              <Star className="h-4 w-4" fill="currentColor" />
              <span className="text-xs font-bold uppercase tracking-wider text-secondary">
                {t("currentBalance")}
              </span>
            </div>
            <div className="mb-4 flex items-baseline gap-2">
              <AnimatedCounter value={balance} format={formatNumber} className="text-5xl font-extrabold text-primary" />
              <span className="font-bold text-primary/80">{t("pts")}</span>
            </div>
            <div className="space-y-3 rounded-xl border bg-card/60 p-4">
```

with:

```tsx
          <section className="nb-border nb-shadow rounded-xl bg-chip p-5">
            <div className="mb-2 flex items-center gap-2 text-primary">
              <Star className="h-4 w-4" fill="currentColor" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-secondary">
                {t("currentBalance")}
              </span>
            </div>
            <div className="mb-4 flex items-baseline gap-2">
              <AnimatedCounter value={balance} format={formatNumber} className="text-5xl font-extrabold text-price" />
              <span className="font-extrabold text-price/80">{t("pts")}</span>
            </div>
            <div className="nb-border-sm space-y-3 rounded-xl bg-card p-4">
```

- [ ] **Step 2: Re-skin the tier-progress and redeem-CTA cards (lines 84-105)**

Replace:

```tsx
          <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
              <h3 className="self-start font-bold text-card-foreground">{currentTierName}</h3>
              <ProgressRing percent={progressPercent} size={88} strokeWidth={7}>
                <span className="text-lg font-bold text-accent-foreground">{progressPercent}%</span>
              </ProgressRing>
              <p className="text-center text-xs text-secondary">
                {nextTierName && tier?.pointsToNext != null
                  ? t("tierProgress", { points: tier.pointsToNext, tier: nextTierName })
                  : t("tierMaxReached")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRewardsOpen(true)}
              className="flex flex-col justify-between rounded-xl bg-primary p-4 text-left text-primary-foreground shadow-sm transition-opacity hover:opacity-90 animate-pulse-subtle"
            >
```

with:

```tsx
          <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="nb-border nb-shadow-sm flex flex-col items-center justify-center gap-3 rounded-xl bg-card p-4">
              <h3 className="self-start font-extrabold text-card-foreground">{currentTierName}</h3>
              <ProgressRing percent={progressPercent} size={88} strokeWidth={7}>
                <span className="text-lg font-extrabold text-accent-foreground">{progressPercent}%</span>
              </ProgressRing>
              <p className="text-center text-xs text-secondary">
                {nextTierName && tier?.pointsToNext != null
                  ? t("tierProgress", { points: tier.pointsToNext, tier: nextTierName })
                  : t("tierMaxReached")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRewardsOpen(true)}
              className="nb-border nb-shadow-sm nb-press-sm flex flex-col justify-between rounded-xl bg-primary p-4 text-left text-primary-foreground"
            >
```

(Dropped `animate-pulse-subtle` — a continuously-looping ambient animation is exactly what the spec's motion rules exclude for anything but marketing-hero moments; the redeem CTA doesn't need to pulse forever to be noticed, especially once it has the new bold outline/shadow treatment.)

- [ ] **Step 3: Re-skin the "My Redemptions" link and promo card (lines 108-127)**

Replace:

```tsx
          <Link
            href="/loyalty/redemptions"
            className="mt-3 flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted"
          >
```

with:

```tsx
          <Link
            href="/loyalty/redemptions"
            className="nb-border nb-shadow-sm nb-press-sm mt-3 flex items-center justify-between rounded-xl bg-card p-4"
          >
```

Replace:

```tsx
          <section className="mt-3 rounded-xl border bg-card p-4 shadow-sm">
```

with:

```tsx
          <section className="nb-border nb-shadow-sm mt-3 rounded-xl bg-card p-4">
```

- [ ] **Step 4: Re-skin the transaction rows (line 153)**

Replace:

```tsx
                    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-sm">
```

with:

```tsx
                    <div className="nb-border-sm flex items-center justify-between gap-3 rounded-xl bg-card p-3">
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm test` — expected: 140 tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/customer/loyalty-view.tsx
git commit -m "Re-skin Loyalty to Neubrutalist Modern"
```

---

### Task 8: Push Phase 2

**Files:** none.

- [ ] **Step 1: Push to `main`**

```bash
git push origin main
```

- [ ] **Step 2: Update `daily.md`**

Note Phase 2 (Cart, Checkout, Order Tracking, Order History, Profile, Loyalty) code-complete and pushed, live verification still deferred by explicit user request (same as Phase 1), Phase 3 (POS, KDS) next per the spec's rollout order.
