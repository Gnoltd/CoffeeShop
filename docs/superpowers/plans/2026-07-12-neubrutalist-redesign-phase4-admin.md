# Neubrutalist Modern Redesign — Phase 4 (Admin, all 8 views) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the Admin shell (sidebar + mobile drawer) and all 8 views (Dashboard, Menu Management, Inventory, Tables, Food Cost, Shift, Staff, Settings) to Neubrutalist Modern, at the same denser Staff/Admin scale used in Phase 3. This is the last phase of the redesign.

**Architecture:** Same mechanical substitution proven in Phases 1-3. Admin's pages share one dominant repeated pattern — `rounded-xl border bg-card p-{4,5} shadow-sm` for every KPI tile/panel/table wrapper — verified identical across `dashboard-view.tsx`, `inventory-management.tsx`, `tables-management.tsx`, `staff-accounts.tsx`, and `shift-report-detail.tsx` by reading all of them. **Two corrections found while grounding this plan in the real code**: (1) `components/staff/staff-nav.tsx`'s sibling, the Admin sidebar (`admin-sidebar.tsx` + `admin-mobile-header.tsx`), already has a fully working mobile drawer (`SideDrawer` motion primitive) — no drawer needs building, only re-skinning. (2) `daily.md` has carried a note across three phases claiming Shift's Cash/Card/VNPay breakdown was still-needed new work — it's wrong. `shift-report-detail.tsx` already renders a full `byMethod` grid (cash/stripe/vnpay icons, counts, totals) for both the live shift and any selected historical shift. This phase only re-skins it.

**Tech Stack:** Next.js App Router, React 19, Tailwind v4, existing `framer-motion` — no new dependency.

## Global Constraints

- No backend/RPC/schema changes, no route/IA changes — presentational only.
- Staff/Admin density: `nb-border-sm`/`nb-shadow-sm`/`nb-press-sm` throughout, matching Phase 3.
- **Blanket substitution rule** (verified identical across every file in this phase): any container with the exact class fragment `rounded-xl border bg-card p-4 shadow-sm` or `rounded-xl border bg-card p-5 shadow-sm` becomes `nb-border-sm nb-shadow-sm rounded-xl bg-card p-4` / `p-5` (drop `border`, drop `shadow-sm`, add the two `nb-*` classes) — every occurrence in every file listed below, not just the ones individually shown in a task's steps.
- KDS/Tables' functional status colors (`bg-green-50`/`bg-red-50`/`bg-amber-50`, `text-green-700`/`text-red-700`/`text-amber-700`, table-status pill backgrounds) are a status palette, not brand tokens — leave hues as-is, per the same Phase 3 rule.
- The shared `Card` component (`components/ui/card.tsx`) has no `variant` prop (plain `className` passthrough, no `cva`) — Task 6 and Task 8 (the two files using `<Card>`) pass `nb-border nb-shadow` directly via `className` at each call site rather than adding a variant.
- Do not touch `hooks/useInventory.tsx`, `hooks/useTables.tsx`, `hooks/useShift.tsx`, `hooks/useDashboardStats.tsx`, or any `lib/supabase/*.ts` call.
- Verification: `npx tsc --noEmit` + `npm test` after every task. Live verification deferred by explicit user request, same as Phases 1-3.

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `components/admin/admin-sidebar.tsx` | Modify | Re-skin the logo mark and nav links (desktop + mobile drawer share `AdminNavContent`) |
| `components/admin/admin-mobile-header.tsx` | Modify | Re-skin the hamburger button |
| `components/admin/dashboard-view.tsx` | Modify | Re-skin KPI tiles, revenue chart panel, best-sellers panel, low-stock table, table-status panel |
| `components/admin/menu-management.tsx` | Modify | Re-skin search/category-filter row, item table/rows |
| `components/admin/inventory-management.tsx` | Modify | Re-skin KPI tiles, tab switch, ingredient table, status badges |
| `components/admin/tables-management.tsx` | Modify | Re-skin KPI tiles, table cards, status-toggle button |
| `components/admin/food-cost-calculator.tsx` | Modify | Re-skin the `Card` wrapper and results card |
| `components/admin/shift-closing.tsx` | Modify | Re-skin the tab switch and stat panels |
| `components/admin/shift-report-detail.tsx` | Modify | Re-skin the three report sections (already has the Cash/Card/VNPay breakdown — re-skin only) |
| `components/admin/staff-accounts.tsx` | Modify | Re-skin the created-password banner and (in Task 9) table rows |
| `components/admin/settings-view.tsx` | Modify | Re-skin the `Card` wrappers |

---

### Task 1: Re-skin Admin sidebar + mobile header

**Files:**
- Modify: `components/admin/admin-sidebar.tsx`
- Modify: `components/admin/admin-mobile-header.tsx`

- [ ] **Step 1: Re-skin the logo mark and nav links in `admin-sidebar.tsx`**

Replace:

```tsx
      <Link href="/" className="mb-6 flex items-center gap-2 px-4" onClick={onNavigate}>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Coffee className="h-5 w-5" />
        </div>
        <span className="font-bold text-primary">{tBrand("name")}</span>
      </Link>
```

with:

```tsx
      <Link href="/" className="mb-6 flex items-center gap-2 px-4" onClick={onNavigate}>
        <div className="nb-border-sm flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Coffee className="h-5 w-5" />
        </div>
        <span className="font-extrabold text-primary">{tBrand("name")}</span>
      </Link>
```

Replace both occurrences (`NAV_ITEMS` map and `FULFILLMENT_NAV_ITEMS` map share the identical class string) of:

```tsx
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted"
              )}
```

with:

```tsx
              className={cn(
                "nb-border-sm flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-extrabold",
                isActive
                  ? "border-ink bg-primary text-primary-foreground"
                  : "border-transparent text-muted-foreground"
              )}
```

- [ ] **Step 2: Re-skin the hamburger button in `admin-mobile-header.tsx`**

Replace:

```tsx
        className="rounded-lg p-1.5 text-card-foreground transition-colors hover:bg-muted"
```

with:

```tsx
        className="nb-border-sm rounded-lg bg-card p-1.5 text-card-foreground"
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm test` — expected: 140 tests pass.

- [ ] **Step 4: Commit**

```bash
git add components/admin/admin-sidebar.tsx components/admin/admin-mobile-header.tsx
git commit -m "Re-skin Admin sidebar + mobile header to Neubrutalist Modern"
```

---

### Task 2: Re-skin `DashboardView`

**Files:**
- Modify: `components/admin/dashboard-view.tsx`

- [ ] **Step 1: Re-skin the four KPI tiles**

Replace:

```tsx
        <Link
          href="/admin/shift"
          className="rounded-xl border bg-card p-5 shadow-sm transition-colors hover:border-primary/40 hover:shadow-md"
        >
```

with:

```tsx
        <Link
          href="/admin/shift"
          className="nb-border-sm nb-shadow-sm nb-press-sm rounded-xl bg-card p-5"
        >
```

Replace both plain (non-link) KPI tiles' identical class:

```tsx
        <div className="rounded-xl border bg-card p-5 shadow-sm">
```

with:

```tsx
        <div className="nb-border-sm nb-shadow-sm rounded-xl bg-card p-5">
```

Replace the low-stock-alert tile:

```tsx
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 shadow-sm">
```

with:

```tsx
        <div className="nb-border-sm nb-shadow-sm rounded-xl border-destructive bg-destructive/5 p-5">
```

- [ ] **Step 2: Re-skin the revenue-chart panel, best-sellers panel, low-stock table panel, and table-status panel**

Replace all four remaining occurrences of:

```tsx
        <div className="rounded-xl border bg-card p-5 shadow-sm lg:col-span-2">
```

and

```tsx
        <div className="rounded-xl border bg-card p-5 shadow-sm">
```

(there are four total: revenue chart, best sellers, low-stock table, table-status — the first has the extra `lg:col-span-2`)

with the same substitution as Step 1: `nb-border-sm nb-shadow-sm rounded-xl bg-card p-5` (keep `lg:col-span-2` on the revenue chart's).

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm test` — expected: 140 tests pass.

- [ ] **Step 4: Commit**

```bash
git add components/admin/dashboard-view.tsx
git commit -m "Re-skin Admin Dashboard to Neubrutalist Modern"
```

---

### Task 3: Re-skin `MenuManagement`

**Files:**
- Modify: `components/admin/menu-management.tsx`

- [ ] **Step 1: Re-skin the "Add Item" button and search input**

Replace:

```tsx
        <Button className="h-10 gap-2" onClick={() => setFormMode({ type: "add" })}>
```

with:

```tsx
        <Button variant="neubrutal" className="h-10 gap-2" onClick={() => setFormMode({ type: "add" })}>
```

Replace:

```tsx
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-10 pl-9"
          />
```

with:

```tsx
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="nb-border-sm h-10 rounded-lg bg-card pl-9"
          />
```

- [ ] **Step 2: Read the rest of the file (past line 180) and re-skin the item-list/table container and category-filter chips**

This file wasn't fully read while grounding this plan — its item-list rendering (past line 180) needs the same treatment as `inventory-management.tsx`'s ingredient table (Task 4) and `tables-management.tsx`'s table cards (Task 5): any `rounded-xl border bg-card ... shadow-sm` list/table wrapper becomes `nb-border-sm nb-shadow-sm rounded-xl bg-card ...`, any category-filter chip button matching the `whitespace-nowrap rounded-* px-* py-* text-sm font-bold` shape used elsewhere in this codebase (see `pos-terminal.tsx`'s category pills, already re-skinned in Phase 3) gets `nb-border-sm nb-shadow-sm nb-press-sm` added and its `hover:` affordance dropped, and pagination controls (Prev/Next) get `variant="outline"` swapped for a `nb-border-sm` treatment matching the KDS/Tables pattern. Apply this by hand while implementing — read the actual current file content first (it may have shifted slightly since this plan was written), then follow the same substitution pattern demonstrated in every other task in this plan.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm test` — expected: 140 tests pass.

- [ ] **Step 4: Commit**

```bash
git add components/admin/menu-management.tsx
git commit -m "Re-skin Admin Menu Management to Neubrutalist Modern"
```

---

### Task 4: Re-skin `InventoryManagement`

**Files:**
- Modify: `components/admin/inventory-management.tsx`

- [ ] **Step 1: Re-skin the "Add Ingredient" button**

Replace:

```tsx
        <Button className="h-10 gap-2" onClick={() => setFormMode({ type: "add" })}>
```

with:

```tsx
        <Button variant="neubrutal" className="h-10 gap-2" onClick={() => setFormMode({ type: "add" })}>
```

- [ ] **Step 2: Re-skin the three KPI tiles**

Replace all three occurrences of:

```tsx
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
```

with:

```tsx
        <div className="nb-border-sm nb-shadow-sm flex items-center gap-3 rounded-xl bg-card p-4">
```

- [ ] **Step 3: Re-skin the Ingredients/Logs tab switch**

Replace both occurrences of the tab button pattern:

```tsx
          className={cn(
            "border-b-2 px-4 py-2 text-sm font-bold transition-colors",
            tab === "ingredients" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
          )}
```

(and the analogous `tab === "logs"` one) with:

```tsx
          className={cn(
            "border-b-4 px-4 py-2 text-sm font-extrabold",
            tab === "ingredients" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
          )}
```

(same for the `logs` tab — swap `border-b-2`→`border-b-4`, `font-bold`→`font-extrabold`, drop `transition-colors`.)

- [ ] **Step 4: Re-skin the ingredient table wrapper**

Replace:

```tsx
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
```

with:

```tsx
        <div className="nb-border-sm nb-shadow-sm overflow-x-auto rounded-xl bg-card">
```

- [ ] **Step 5: Re-skin the stock-status badge**

Replace:

```tsx
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-bold",
                          isOut
                            ? "border-destructive/40 bg-destructive text-destructive-foreground"
                            : isLow
                              ? "border-destructive/20 bg-destructive/10 text-destructive"
                              : "border-green-200 bg-green-100 text-green-700"
                        )}
```

with:

```tsx
                        className={cn(
                          "nb-border-sm rounded-full px-2.5 py-1 text-xs font-extrabold",
                          isOut
                            ? "bg-destructive text-destructive-foreground"
                            : isLow
                              ? "bg-destructive/10 text-destructive"
                              : "bg-green-100 text-green-700"
                        )}
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm test` — expected: 140 tests pass.

- [ ] **Step 7: Commit**

```bash
git add components/admin/inventory-management.tsx
git commit -m "Re-skin Admin Inventory to Neubrutalist Modern"
```

---

### Task 5: Re-skin `TablesManagement`

**Files:**
- Modify: `components/admin/tables-management.tsx`

- [ ] **Step 1: Re-skin the "Add Table" button**

Replace:

```tsx
        <Button className="h-10 gap-2" onClick={() => setShowAddForm(true)}>
```

with:

```tsx
        <Button variant="neubrutal" className="h-10 gap-2" onClick={() => setShowAddForm(true)}>
```

- [ ] **Step 2: Re-skin the four KPI tiles**

Replace all four occurrences of:

```tsx
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
```

with:

```tsx
        <div className="nb-border-sm nb-shadow-sm flex items-center gap-3 rounded-xl bg-card p-4">
```

- [ ] **Step 3: Re-skin each table card**

Replace:

```tsx
              className={cn(
                "flex flex-col items-center gap-3 rounded-xl border bg-card p-5 shadow-sm transition-colors",
                isEditing && "border-primary ring-2 ring-primary/30"
              )}
```

with:

```tsx
              className={cn(
                "nb-border-sm nb-shadow-sm flex flex-col items-center gap-3 rounded-xl bg-card p-5",
                isEditing && "border-primary"
              )}
```

- [ ] **Step 4: Read the rest of the file (past line 150) and re-skin the status-toggle button, QR download button, and edit/save controls**

Not fully read while grounding this plan. Apply the same substitution pattern as every other task: any `rounded-* border ...`/`shadow-sm` element becomes `nb-border-sm`/`nb-shadow-sm`, any button relying on a `hover:` color shift gets `nb-press-sm` and a solid resting-state background instead. Read the actual current file content first, then follow the pattern.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm test` — expected: 140 tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/admin/tables-management.tsx
git commit -m "Re-skin Admin Tables to Neubrutalist Modern"
```

---

### Task 6: Re-skin `FoodCostCalculator`

**Files:**
- Modify: `components/admin/food-cost-calculator.tsx`

- [ ] **Step 1: Re-skin the main `Card` and the results `Card`**

Replace:

```tsx
      <Card>
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl">{t("title")}</CardTitle>
```

with:

```tsx
      <Card className="nb-border nb-shadow">
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl font-extrabold">{t("title")}</CardTitle>
```

Replace:

```tsx
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-lg">{t("resultsTitle")}</CardTitle>
```

with:

```tsx
            <Card className="nb-border-sm nb-shadow-sm bg-chip">
              <CardHeader>
                <CardTitle className="text-lg font-extrabold">{t("resultsTitle")}</CardTitle>
```

- [ ] **Step 2: Re-skin the Calculate/Clear buttons**

Replace:

```tsx
            <Button onClick={handleCalculate} className="h-11 min-w-11 flex-1 sm:flex-none sm:px-8">
```

with:

```tsx
            <Button variant="neubrutal" onClick={handleCalculate} className="h-11 min-w-11 flex-1 sm:flex-none sm:px-8">
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm test` — expected: 140 tests pass.

- [ ] **Step 4: Commit**

```bash
git add components/admin/food-cost-calculator.tsx
git commit -m "Re-skin Admin Food Cost Calculator to Neubrutalist Modern"
```

---

### Task 7: Re-skin `ShiftClosing` and `ShiftReportDetail`

**Files:**
- Modify: `components/admin/shift-closing.tsx`
- Modify: `components/admin/shift-report-detail.tsx`

**Note**: `ShiftReportDetail` already renders the full Cash/Card/VNPay breakdown (its `byMethod` section, lines 73-94) for both the live shift (via `shift-closing.tsx`'s `report`) and any selected historical shift (via `handleSelectShift`) — this task is a pure re-skin, no new data wiring, correcting the `daily.md` note that's carried this as outstanding work across three phases.

- [ ] **Step 1: Re-skin all three `ShiftReportDetail` sections**

Replace all three occurrences of:

```tsx
      <section className="rounded-xl border bg-card p-5 shadow-sm">
```

with:

```tsx
      <section className="nb-border-sm nb-shadow-sm rounded-xl bg-card p-5">
```

Replace the per-method row:

```tsx
              <div key={method} className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
```

with:

```tsx
              <div key={method} className="nb-border-sm flex items-center gap-3 rounded-lg bg-chip p-3">
```

- [ ] **Step 2: Read `shift-closing.tsx` in full (only the first 100 lines were read while grounding this plan) and re-skin its tab switch, stat panels, and Open/Close Shift form**

Apply the same substitution pattern: `rounded-* border ... shadow-sm` → `nb-border-sm nb-shadow-sm`, the tab switch → same `border-b-4` treatment as Task 4 Step 3, primary action buttons (Open Shift, Close Shift) → `variant="neubrutal"`. Read the actual current file first, then follow the pattern.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm test` — expected: 140 tests pass.

- [ ] **Step 4: Commit**

```bash
git add components/admin/shift-closing.tsx components/admin/shift-report-detail.tsx
git commit -m "Re-skin Admin Shift (Current/History + report detail) to Neubrutalist Modern"
```

---

### Task 8: Re-skin `StaffAccounts`

**Files:**
- Modify: `components/admin/staff-accounts.tsx`

- [ ] **Step 1: Re-skin the "Add Staff" button**

Replace:

```tsx
        <Button className="h-10 gap-2" onClick={() => setFormMode({ type: "add" })}>
```

with:

```tsx
        <Button variant="neubrutal" className="h-10 gap-2" onClick={() => setFormMode({ type: "add" })}>
```

- [ ] **Step 2: Re-skin the created-password banner**

Replace:

```tsx
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
```

with:

```tsx
        <div className="nb-border-sm flex items-center justify-between gap-3 rounded-lg bg-chip px-4 py-3">
```

- [ ] **Step 3: Read the rest of the file (past line 140) and re-skin the staff table wrapper, role badges, and active/inactive toggle**

Not fully read while grounding this plan. Apply the same pattern as `inventory-management.tsx`'s table (Task 4 Steps 4-5): table wrapper `rounded-xl border bg-card shadow-sm` → `nb-border-sm nb-shadow-sm`, role badges (`ROLE_STYLES`, currently `border-*/20 bg-*/10 text-*` per role) → add `nb-border-sm`, keep the role-specific hue. Read the actual current file first, then follow the pattern.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm test` — expected: 140 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/admin/staff-accounts.tsx
git commit -m "Re-skin Admin Staff Accounts to Neubrutalist Modern"
```

---

### Task 9: Re-skin `SettingsView`

**Files:**
- Modify: `components/admin/settings-view.tsx`

- [ ] **Step 1: Re-skin the Shop Info `Card`**

Replace:

```tsx
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
```

with:

```tsx
      <Card className="nb-border nb-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-extrabold">
```

- [ ] **Step 2: Read the rest of the file (past line 140) and re-skin the Loyalty `Card`, the enable-toggle switch, and the Save/Cancel buttons**

Not fully read while grounding this plan — the file continues past the Shop Info card into a Loyalty Program `Card` (per CLAUDE.md's description: enable toggle + earn/redeem rate fields) and Save/Cancel actions. Apply: the second `<Card>` gets the same `className="nb-border nb-shadow"` as Step 1, the enable-toggle switch gets the same treatment as any other toggle in this codebase (check for the `absolute left-0.5 top-0.5`/`translate-x-*` pattern per CLAUDE.md's toggle-switch gotcha — add `nb-border-sm` to its track, don't change the thumb-positioning logic), and the Save button gets `variant="neubrutal"`. Read the actual current file first, then follow the pattern.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm test` — expected: 140 tests pass.

- [ ] **Step 4: Commit**

```bash
git add components/admin/settings-view.tsx
git commit -m "Re-skin Admin Settings to Neubrutalist Modern"
```

---

### Task 10: Push Phase 4 — redesign complete

**Files:** none.

- [ ] **Step 1: Push to `main`**

```bash
git push origin main
```

- [ ] **Step 2: Update `daily.md`**

Mark the full "Neubrutalist Modern" redesign (all 4 phases) code-complete and pushed. Live verification across all phases is still deferred by explicit user request — note this as the one remaining step for the whole redesign, and that it should happen as a single pass across all pages/both themes/both locales/real mobile devices now that everything is shipped, rather than phase-by-phase. Remove the long-carried (and now-corrected) notes about the app-switcher and Shift payment breakdown being outstanding work — both were already-shipped features found during Phase 3/4 planning, not gaps.
