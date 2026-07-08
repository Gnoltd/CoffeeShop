# Next up: resolve the stranded order, then confirm all three fixes live

## Status

**Third live bug found and fixed**: "tap Cleaning Done, nothing
happens" turned out to be an RLS gap, not a UI bug —
`tables_admin_all` (migration `0005`) only ever granted UPDATE on
`public.tables` to `manager`/`admin`. But KDS's Tables column (where
Cleaning Done lives) is reachable by plain `staff` role too, per
middleware's `/staff/*` gating. A staff-role tap was silently rejected
by Postgres — and none of the four KDS table actions (Cleaning Done,
Served, Confirm Cash Received, Mark Cash) caught the rejection, so
nothing ever showed an error either. Fixed with two changes:
1. New RLS policy `tables_update_staff` (migration `0025`), mirroring
   `orders_update_staff`'s existing precedent — staff can now write to
   `tables`.
2. All four KDS table actions now catch failures and show an inline
   error instead of doing nothing silently.

**If you were testing under the staff test account, this was it** —
try Cleaning Done again, it should work now.

**Second live bug found and fixed**: Checkout let a customer pick
Dine-in manually without ever scanning a table's QR code, using a
`FALLBACK_TABLE_NUMBER = "04"` display fallback while sending
`table_id: null` to `place_order`. Since the entire table-driven KDS
model (table card, Served button, occupancy) keys off `table_id`, any
such order was invisible everywhere — no Served button, no occupancy
tracking, nothing. This is very likely what actually caused the "table
2 stuck with no button" report just before it — table 2's own row
turned out fine (it was the earlier trigger-scope bug), but a live scan
of the DB turned up a **currently-stranded real order**
(`c5b531cf-2661-4bac-9217-511de8b5d3f4`, `status: ready`, `table_id:
null`, created 2026-07-08) that had no table card to route a Served
action through, and no order-card button either (removed for dine-in
by the deferred-payment work). Two fixes shipped:
1. Checkout now **requires a real scanned table** for Dine-in — the
   toggle is disabled with a tooltip until `activeTable` is set, with
   an inline "Scan Table QR" button (reuses the existing camera
   scanner) right there. The fake fallback is gone entirely.
2. KDS board: the Ready-column action button is now restored as a
   fallback for any dine-in order that (still) has no `table_id` — a
   safety net so a stray/orphaned order like the one above can never be
   completely un-actionable again.

**The stranded order still needs manual resolution** — now that the
KDS safety-net button is live, it should show a "Complete" button in
KDS's Ready column despite being dine-in; tap it to clear it (it has no
real table to free, so no Cleaning transition will follow — that's
expected for this one orphaned case).

**Live bug found and fixed (migration `0024`)**: `sync_table_occupancy`
(the trigger that moves a table to Cleaning) was scoped to `after
update of status` — Postgres only fires a column-scoped trigger when
the *client's own* UPDATE statement names that column. For a Pay Later
order, once served, payment finalizing (Stripe webhook / VNPay IPN /
cash confirm) only updates `payment_status` — a separate trigger
(`complete_order_when_served_and_paid`) then flips `status` to
`completed` as a side effect, which the column-scoped trigger never
saw. Net effect: order genuinely completed and got paid, but its table
stayed `occupied` forever. Fixed by dropping the column scope (fires on
every order update now, unconditionally — the function body already
gates its own logic, matching how the other order triggers already
work). Table 2 specifically was left manually stuck by this — user is
clearing it by hand via the Admin Tables/KDS tap-to-cycle control.
**Not yet re-verified live** that the fix actually holds — next
priority, see the two-step check below before anything else.

**Deferred payment + table-driven service lifecycle is fully built and
pushed to `main`** (spec:
`docs/superpowers/specs/2026-07-08-deferred-payment-service-lifecycle-design.md`,
plan: `docs/superpowers/plans/2026-07-08-deferred-payment-service-lifecycle.md`).
Migrations `0022`+`0023` applied live; 4 Edge Functions (`place-order`,
`pay-order`, `stripe-webhook`, `vnpay-ipn`, `vnpay-return`) deployed live.

**Revised same day**: originally Pay Later only deferred *when*
payment happened — the payment *method* was still picked at checkout.
Corrected per user feedback: for Pay Later, checkout now asks nothing
but Pay Now/Pay Later — no method picker at all. The method
(Cash/Card/VNPay) is chosen at the very end, once the order is
`served`:
- **Customer** picks it on their tracking page (3-way picker) — Cash
  just records the choice for staff to collect in person; Card/VNPay
  records it and redirects to that gateway immediately.
- **Staff** can also mark Cash directly from the table's card in the
  KDS Tables column ("Mark Cash") — Stripe/VNPay stay customer-only
  since staff can't complete a hosted checkout on the guest's behalf.
- `orders.payment_method` is now nullable; `place_order` only requires
  it when `payAt = 'now'`. See the spec's "Revision" section for full
  detail.

Typecheck, all 69 Vitest tests, and `npm run build` all pass locally.

**Not yet done: the live walkthrough on Vercel.** This session had no
browser automation available, so the actual click-through verification
(place a Pay Later order with no method chosen, watch it hit KDS
immediately, tap "Served" on the table card, choose a method from the
tracking page AND separately test staff's "Mark Cash", confirm
auto-completion + table moves to Cleaning, check the failure-retry path
doesn't cancel a served order) has not been run. Do this next — the
plan file's Task 14 checklist is close but predates this revision, so
add "choose method at the end" scenarios when walking through it.

**Priority order for next session:**
1. Clear Table 2 manually (tap-to-cycle in Admin Tables or KDS).
2. Clear the stranded orphaned order (`c5b531cf...`) via the now-
   restored KDS Ready-column button.
3. Confirm Dine-in is actually blocked in Checkout without a scan, and
   that the inline "Scan Table QR" button works end-to-end.
4. Re-run the exact scenario that broke the cleaning trigger: dine-in
   (with a real scanned table this time), Pay Later, choose Stripe or
   VNPay once served, complete payment — confirm the table flips to
   Cleaning automatically (no manual tap needed). This is the one thing
   that must be re-verified before trusting the rest of the
   deferred-payment feature.
5. Only after that passes, work through the rest of the original
   checklist (Cash Pay Later, pickup, failure-retry path).

Also still pending from the previous feature: **table status (shipped
2026-07-08, in CLAUDE.md) has never been live-verified on Vercel
either** — worth doing both walkthroughs in the same pass, since the
deferred-payment feature builds directly on top of table status (same
`sync_table_occupancy` trigger, same KDS Tables column).

## Open / not started

1. **Admin Dashboard using real, live data** — revenue/orders/loyalty
   KPIs and the 7-day chart are still fixed mock numbers (documented,
   not hidden, in CLAUDE.md). Needs real aggregation queries + Realtime.
   The Table Status card already on that dashboard is separate and
   already real — this item is only about the remaining mock KPIs/chart.

## Known gaps (documented, not hidden — pick up whenever that area is next touched)

- `VNPAY_RETURN_URL` (synced to Vercel) is dead — VNPay's actual return
  URL is built dynamically in `place-order` pointing at the Supabase
  function URL instead. Worth removing the unused Vercel var, or
  documenting why it's kept, next time env vars are audited.
- `checkout-view.tsx`'s `orderType` state only reads `activeTable` once
  at first render — can default to "pickup" even when `activeTable`
  becomes populated moments later after a full reload (before
  `TablesProvider`'s `localStorage` hydration effect runs). Fix options:
  re-derive `orderType` reactively, or gate Checkout's initial render on
  hydration finishing.
- `next build` still prints the "middleware deprecated, use proxy"
  warning (Next.js 16.2.10). Renaming `middleware.ts` → `proxy.ts` also
  touches `lib/middleware-rules.ts`, which it depends on. Not urgent.
- No Vitest/RTL coverage beyond the `lib/supabase/*.ts` query layers and
  `lib/middleware-rules.ts`/`lib/get-current-role.ts` — component-level
  tests were never added (skipped so far, not a regression).
- POS (`components/staff/pos-terminal.tsx`) was not touched by the
  deferred-payment work — it still always collects payment in person
  (`paymentCollected: true`), so Pay Later is a self-checkout-only
  concept for now. That's intentional (POS staff are standing right
  there, no reason to defer), not an oversight, but worth stating
  explicitly since it's not written down anywhere else yet.
- A **pickup** Pay Later order sitting at `served`/unpaid/no-method-
  chosen has no staff-side "Mark Cash" surface (unlike dine-in's table
  card) — only the customer's own tracking page can choose a method for
  it. Pickup has no table to attach that control to. Minor, real gap;
  not blocking since the customer path already covers it.

Two throwaway test accounts (staff/customer roles, credentials in
`.env.local` and the gitignored `test-accounts.md`) are kept
deliberately for the user's ongoing manual testing — not a cleanup gap,
don't remove or flag these.
