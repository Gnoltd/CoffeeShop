# Neubrutalist Modern Redesign — Phase 3 (POS, KDS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin Staff POS and Kitchen Display (KDS) to Neubrutalist Modern, denser than Customer per the design spec, functional motion only.

**Architecture:** Same mechanical substitution proven in Phases 1-2, at the denser Staff/Admin scale (`nb-border-sm`/`nb-shadow-sm` as the default, not the Customer-scale `nb-border`/`nb-shadow`). **Correction from the design spec**: the spec's Per-Surface Application section said a "POS/KDS/Admin app-switcher pill in the top bar" was new UI not previously specced — that's wrong. `components/staff/staff-nav.tsx` already is that switcher (POS/Kitchen Display/Rewards links, plus Dashboard for admin-capable roles, with active-state highlighting) — it just needs the Neubrutalist re-skin like everything else, not building from scratch.

**Tech Stack:** Next.js App Router, React 19, Tailwind v4, existing `framer-motion` — no new dependency.

## Global Constraints

- No backend/RPC/schema changes, no route/IA changes — presentational only.
- Staff/Admin density: `nb-border-sm`/`nb-shadow-sm`/`nb-press-sm` are the default weight here (not the Customer-scale `nb-border`/`nb-shadow`), per the spec's "denser spacing scale than Customer" rule.
- KDS's semantic status colors (`bg-zinc-500`/`bg-amber-600`/`bg-green-600` column headers, `bg-green-50`/`bg-red-50`/`bg-amber-50` table-status backgrounds, `bg-green-100 text-green-700` etc. status pills) are a **functional status palette, not brand tokens** — leave their hues as-is. Only add `nb-border-sm`/`nb-shadow-sm` structure around them; don't recolor them to `--primary`/`--chip`/etc.
- Every container matching `rounded-* border bg-card/bg-muted ...` not individually called out in a task's steps still gets the same mechanical substitution demonstrated in that file's other edits — same rule as Phase 2.
- Do not touch `hooks/useKitchenOrders.tsx`, `hooks/useTables.tsx`, or any `lib/supabase/*.ts` call.
- Verification: `npx tsc --noEmit` + `npm test` after every task. Live verification deferred by explicit user request, same as Phases 1-2.

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `components/staff/staff-nav.tsx` | Modify | Re-skin the POS/Kitchen Display/Rewards/Dashboard nav links to a Neubrutalist segmented-pill look |
| `components/staff/pos-terminal.tsx` | Modify | Re-skin search bar, category pills, item grid cards, order panel (lines, type/table toggle, payment picker, charge button) |
| `components/staff/kitchen-top-bar.tsx` | Modify | Re-skin the Realtime connection-status pill |
| `components/staff/kitchen-board.tsx` | Modify | Re-skin column containers and order cards |
| `components/staff/kitchen-tables-column.tsx` | Modify | Re-skin table cards and their action buttons |
| `components/staff/kitchen-pending-payment.tsx` | Modify | Re-skin the awaiting-payment banner |
| `components/staff/kitchen-stats-footer.tsx` | Modify | Re-skin the footer container (load bar/colors stay as-is — functional palette) |

---

### Task 1: Re-skin `StaffNav`

**Files:**
- Modify: `components/staff/staff-nav.tsx`

- [ ] **Step 1: Re-skin the nav links**

Replace:

```tsx
      <nav className="flex gap-2">
        {navItems.map(({ href, labelKey }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              pathname === href
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {tNav(labelKey)}
          </Link>
        ))}
      </nav>
```

with:

```tsx
      <nav className="nb-border-sm nb-shadow-sm flex gap-1 rounded-lg bg-card p-1">
        {navItems.map(({ href, labelKey }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-extrabold",
              pathname === href
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            )}
          >
            {tNav(labelKey)}
          </Link>
        ))}
      </nav>
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm test` — expected: 140 tests pass.

- [ ] **Step 3: Commit**

```bash
git add components/staff/staff-nav.tsx
git commit -m "Re-skin StaffNav (POS/KDS/Rewards/Dashboard switcher) to Neubrutalist Modern"
```

---

### Task 2: Re-skin `PosTerminal`

**Files:**
- Modify: `components/staff/pos-terminal.tsx`

- [ ] **Step 1: Re-skin the search input (lines 176-186)**

Replace:

```tsx
        <div className="border-b p-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-10 w-full rounded-lg border-none bg-muted pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
```

with:

```tsx
        <div className="border-b p-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="nb-border-sm h-10 w-full rounded-lg bg-card pl-9 pr-3 text-sm outline-none"
            />
          </div>
        </div>
```

- [ ] **Step 2: Re-skin the category pills (lines 194-210)**

Replace:

```tsx
              className={cn(
                "whitespace-nowrap rounded-lg px-5 py-2.5 text-sm font-bold transition-colors",
                selectedCategory === category.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-card-foreground hover:bg-accent/30"
              )}
```

with:

```tsx
              className={cn(
                "nb-border-sm nb-shadow-sm nb-press-sm whitespace-nowrap rounded-lg px-5 py-2.5 text-sm font-extrabold",
                selectedCategory === category.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-card-foreground"
              )}
```

- [ ] **Step 3: Re-skin the item grid cards (lines 217-230)**

Replace:

```tsx
                  className="flex flex-col gap-2 rounded-xl border bg-card p-2 text-left shadow-sm transition-all hover:shadow-md active:scale-95"
                >
                  <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="h-8 w-8" />
                  </div>
                  <div className="px-1 pb-1">
                    <h3 className="line-clamp-1 font-bold text-card-foreground">{name(item)}</h3>
                    <p className="mt-1 text-lg font-bold text-primary">{formatVND(item.basePrice)}</p>
                  </div>
```

with:

```tsx
                  className="nb-border-sm nb-shadow-sm nb-press-sm flex flex-col gap-2 rounded-xl bg-card p-2 text-left"
                >
                  <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-chip text-muted-foreground">
                    <Icon className="h-8 w-8" />
                  </div>
                  <div className="px-1 pb-1">
                    <h3 className="line-clamp-1 font-bold text-card-foreground">{name(item)}</h3>
                    <p className="mt-1 text-lg font-extrabold text-price">{formatVND(item.basePrice)}</p>
                  </div>
```

- [ ] **Step 4: Re-skin the mobile "view order" bar (lines 259-268)**

Replace:

```tsx
          className="fixed inset-x-4 bottom-4 z-20 flex items-center justify-between rounded-xl bg-primary px-5 py-4 text-primary-foreground shadow-lg md:hidden"
```

with:

```tsx
          className="nb-border nb-shadow fixed inset-x-4 bottom-4 z-20 flex items-center justify-between rounded-xl bg-primary px-5 py-4 text-primary-foreground md:hidden"
```

- [ ] **Step 5: Re-skin `OrderPanel`'s line rows and quantity stepper (lines 393-424)**

Replace:

```tsx
                <div key={line.lineId} className="flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-card-foreground">
                      {locale === "vi" ? line.nameVi : line.nameEn}
                    </h4>
                    {(line.sizeName || line.modifierNames.length > 0) && (
                      <p className="text-xs text-muted-foreground">
                        {[line.sizeName, ...line.modifierNames].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <p className="font-bold text-primary">{formatVND(line.unitPrice * line.quantity)}</p>
                </div>
                <div className="flex items-center gap-2 self-start rounded-lg bg-card p-1">
                  <button
                    type="button"
                    onClick={() => updateQuantity(line.lineId, line.quantity - 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center font-bold">{line.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(line.lineId, line.quantity + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-secondary-foreground transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
```

with:

```tsx
                <div key={line.lineId} className="flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-card-foreground">
                      {locale === "vi" ? line.nameVi : line.nameEn}
                    </h4>
                    {(line.sizeName || line.modifierNames.length > 0) && (
                      <p className="text-xs text-muted-foreground">
                        {[line.sizeName, ...line.modifierNames].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <p className="font-extrabold text-price">{formatVND(line.unitPrice * line.quantity)}</p>
                </div>
                <div className="nb-border-sm flex items-center gap-2 self-start rounded-lg bg-card p-1">
                  <button
                    type="button"
                    onClick={() => updateQuantity(line.lineId, line.quantity - 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-md bg-chip"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center font-bold">{line.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(line.lineId, line.quantity + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-secondary-foreground"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
```

- [ ] **Step 6: Re-skin the order-type toggle (lines 436-458)**

Replace:

```tsx
            <div className="flex rounded-lg bg-muted p-1">
              <button
                type="button"
                onClick={() => setOrderType("dine-in")}
                className={cn(
                  "flex-1 rounded-md py-2 text-xs font-bold transition-all",
                  orderType === "dine-in" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
                )}
              >
                {t("dineIn")}
              </button>
              <button
                type="button"
                onClick={() => setOrderType("takeaway")}
                className={cn(
                  "flex-1 rounded-md py-2 text-xs font-bold transition-all",
                  orderType === "takeaway" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
                )}
              >
                {t("takeaway")}
              </button>
            </div>
```

with:

```tsx
            <div className="nb-border-sm flex rounded-lg bg-card p-1">
              <button
                type="button"
                onClick={() => setOrderType("dine-in")}
                className={cn(
                  "flex-1 rounded-md py-2 text-xs font-extrabold",
                  orderType === "dine-in" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}
              >
                {t("dineIn")}
              </button>
              <button
                type="button"
                onClick={() => setOrderType("takeaway")}
                className={cn(
                  "flex-1 rounded-md py-2 text-xs font-extrabold",
                  orderType === "takeaway" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}
              >
                {t("takeaway")}
              </button>
            </div>
```

- [ ] **Step 7: Re-skin the payment-method picker (lines 483-506)**

Replace:

```tsx
                  className={cn(
                    "rounded-lg border-2 py-2.5 text-[11px] font-bold transition-all",
                    paymentMethod === method
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-transparent bg-muted text-muted-foreground",
                    !enabled && "opacity-50"
                  )}
```

with:

```tsx
                  className={cn(
                    "nb-border-sm nb-shadow-sm rounded-lg py-2.5 text-[11px] font-extrabold",
                    paymentMethod === method
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground",
                    !enabled && "opacity-50"
                  )}
```

- [ ] **Step 8: Re-skin the Charge button (lines 523-534)**

Replace:

```tsx
          className="flex items-center justify-between rounded-xl bg-primary px-5 py-4 text-primary-foreground shadow-lg transition-transform active:scale-95 disabled:opacity-50"
```

with:

```tsx
          className="nb-border nb-shadow nb-press flex items-center justify-between rounded-xl bg-primary px-5 py-4 text-primary-foreground disabled:opacity-50"
```

- [ ] **Step 9: Verify**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm test` — expected: 140 tests pass.

- [ ] **Step 10: Commit**

```bash
git add components/staff/pos-terminal.tsx
git commit -m "Re-skin POS to Neubrutalist Modern"
```

---

### Task 3: Re-skin `KitchenTopBar`

**Files:**
- Modify: `components/staff/kitchen-top-bar.tsx`

- [ ] **Step 1: Re-skin the connection-status pill (lines 25-35)**

Replace:

```tsx
        <div className="flex items-center gap-2 rounded-lg border bg-muted px-2 py-1.5 md:px-3">
```

with:

```tsx
        <div className="nb-border-sm flex items-center gap-2 rounded-lg bg-chip px-2 py-1.5 md:px-3">
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm test` — expected: 140 tests pass.

- [ ] **Step 3: Commit**

```bash
git add components/staff/kitchen-top-bar.tsx
git commit -m "Re-skin KitchenTopBar to Neubrutalist Modern"
```

---

### Task 4: Re-skin `KitchenBoard`

**Files:**
- Modify: `components/staff/kitchen-board.tsx`

- [ ] **Step 1: Re-skin the column container (line 68)**

Replace:

```tsx
              "h-full flex-col overflow-hidden rounded-xl border bg-muted",
```

with:

```tsx
              "nb-border-sm h-full flex-col overflow-hidden rounded-xl bg-muted",
```

- [ ] **Step 2: Re-skin the order card (line 87)**

Replace:

```tsx
                  <div key={order.id} className="rounded-xl border bg-card shadow-sm">
```

with:

```tsx
                  <div key={order.id} className="nb-border-sm nb-shadow-sm rounded-xl bg-card">
```

- [ ] **Step 3: Re-skin the item-quantity chip (line 136)**

Replace:

```tsx
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold text-card-foreground">
```

with:

```tsx
                          <div className="nb-border-sm flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-chip text-sm font-bold text-card-foreground">
```

- [ ] **Step 4: Re-skin the advance-status button (lines 156-165)**

Replace:

```tsx
                        className={cn(
                          "flex w-full items-center justify-center gap-2 rounded-b-xl py-3 text-base font-bold text-white transition-all active:scale-[0.99]",
                          column.status === "paid" && "bg-primary hover:brightness-110",
                          column.status === "preparing" && "bg-amber-600 hover:brightness-110",
                          column.status === "ready" && "bg-green-600 hover:brightness-110"
                        )}
```

with:

```tsx
                        className={cn(
                          "nb-press flex w-full items-center justify-center gap-2 rounded-b-xl border-t-2 border-ink py-3 text-base font-extrabold text-white",
                          column.status === "paid" && "bg-primary",
                          column.status === "preparing" && "bg-amber-600",
                          column.status === "ready" && "bg-green-600"
                        )}
```

(No `nb-shadow`/`nb-border` on the whole card here — this button sits flush at the bottom of an already-outlined card, so only a top border separates it; `nb-press` still gives it the shadow-collapse tap feedback via the card's own border.)

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm test` — expected: 140 tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/staff/kitchen-board.tsx
git commit -m "Re-skin KitchenBoard to Neubrutalist Modern"
```

---

### Task 5: Re-skin `KitchenTablesColumn`

**Files:**
- Modify: `components/staff/kitchen-tables-column.tsx`

- [ ] **Step 1: Re-skin the column container (line 20)**

Replace:

```tsx
        "h-full flex-col overflow-hidden rounded-xl border bg-muted",
```

with:

```tsx
        "nb-border-sm h-full flex-col overflow-hidden rounded-xl bg-muted",
```

- [ ] **Step 2: Re-skin each table row card (lines 44-49)**

Replace:

```tsx
                "flex items-center justify-between gap-2 rounded-lg border p-3",
```

with:

```tsx
                "nb-border-sm flex items-center justify-between gap-2 rounded-lg p-3",
```

- [ ] **Step 3: Re-skin the status-toggle, Mark Served, Confirm Cash, Undo, and Mark Cash buttons**

Replace each of these five button `className` strings (they all currently rely on `hover:` color shifts with no border/shadow):

```tsx
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold transition-colors",
```

with:

```tsx
                    "nb-border-sm nb-shadow-sm nb-press-sm inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-extrabold",
```

Replace:

```tsx
                  className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:brightness-110"
```

with:

```tsx
                  className="nb-border-sm nb-shadow-sm nb-press-sm flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-extrabold text-primary-foreground"
```

Replace both occurrences of:

```tsx
                      className="rounded-lg bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground hover:brightness-110"
```

with:

```tsx
                      className="nb-border-sm nb-shadow-sm nb-press-sm rounded-lg bg-secondary px-3 py-2 text-xs font-extrabold text-secondary-foreground"
```

Replace:

```tsx
                      className="rounded-lg border px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted"
```

with:

```tsx
                      className="nb-border-sm nb-press-sm rounded-lg bg-card px-3 py-2 text-xs font-extrabold text-muted-foreground"
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm test` — expected: 140 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/staff/kitchen-tables-column.tsx
git commit -m "Re-skin KitchenTablesColumn to Neubrutalist Modern"
```

---

### Task 6: Re-skin `KitchenPendingPayment`

**Files:**
- Modify: `components/staff/kitchen-pending-payment.tsx`

- [ ] **Step 1: Re-skin the banner and order chips**

Replace:

```tsx
    <div className="shrink-0 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:bg-amber-950/20">
```

with:

```tsx
    <div className="nb-border-sm shrink-0 rounded-xl border-amber-500 bg-amber-50 p-3 dark:bg-amber-950/20">
```

Replace:

```tsx
          <div key={order.id} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
```

with:

```tsx
          <div key={order.id} className="nb-border-sm flex items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm">
```

Replace the confirm button:

```tsx
            <Button size="sm" className="h-7" onClick={() => onConfirm(order.id)}>
```

with:

```tsx
            <Button size="sm" variant="neubrutal" className="h-7" onClick={() => onConfirm(order.id)}>
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm test` — expected: 140 tests pass.

- [ ] **Step 3: Commit**

```bash
git add components/staff/kitchen-pending-payment.tsx
git commit -m "Re-skin KitchenPendingPayment to Neubrutalist Modern"
```

---

### Task 7: Re-skin `KitchenStatsFooter`

**Files:**
- Modify: `components/staff/kitchen-stats-footer.tsx`

- [ ] **Step 1: Re-skin the footer container**

Replace:

```tsx
    <footer className="flex shrink-0 flex-col gap-2 rounded-xl border bg-muted px-4 py-3 md:h-12 md:flex-row md:items-center md:gap-8 md:px-6 md:py-0">
```

with:

```tsx
    <footer className="nb-border-sm flex shrink-0 flex-col gap-2 rounded-xl bg-muted px-4 py-3 md:h-12 md:flex-row md:items-center md:gap-8 md:px-6 md:py-0">
```

(The load bar and its `bg-green-600`/`bg-amber-600`/`bg-destructive` fill colors are the functional status palette from Global Constraints — left as-is.)

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm test` — expected: 140 tests pass.

- [ ] **Step 3: Commit**

```bash
git add components/staff/kitchen-stats-footer.tsx
git commit -m "Re-skin KitchenStatsFooter to Neubrutalist Modern"
```

---

### Task 8: Push Phase 3

**Files:** none.

- [ ] **Step 1: Push to `main`**

```bash
git push origin main
```

- [ ] **Step 2: Update `daily.md`**

Note Phase 3 (POS, KDS) code-complete and pushed, live verification still deferred by explicit user request. Correct the earlier note claiming the POS/KDS/Admin app-switcher was "new, not previously specced" — `StaffNav` already existed and did this; only its visual re-skin was actually new work. Phase 4 (Admin, all 8 views) next and last per the spec's rollout order.
