# Profile Auth-Gate + Role-Based Navigation — Design

**Date:** 2026-07-06
**Status:** Proposed — pending user review before writing an implementation plan.

## Overview

Fixes a real bug found by the user clicking around the live site:
`components/customer/profile-view.tsx` has zero auth-awareness — it always
renders hardcoded mock data (`INITIAL_PROFILE`) regardless of login state,
never checks the session, and never redirects a logged-out visitor. There's
also no way for a logged-in Staff/Manager/Admin user, browsing the
customer-facing side of the app, to get back to their own work area.

This spec covers two related pieces:

1. **Auth gate** — `/profile`, `/orders` (the Order History list), and
   `/loyalty` require a logged-in session; an anonymous visitor is hard
   redirected to `/login`, the same pattern already used for `/staff` and
   `/admin` in `middleware.ts`.
2. **Role-based navigation** — a logged-in Staff/Manager/Admin user gets a
   role-appropriate "Go to [X]" shortcut back to their own area, shown in
   two places: a card on the Profile page, and a persistent badge in the
   shared header.

Two Stitch mockups were generated in project `4654820544595168289` (screens
`4e4bcae94d9d422f97df6e41e18b6790` — Profile's staff-access card,
`1d413b40d2904396862d12674d5863e9` — Home header's staff badge), approved
by the user, and are the visual reference for implementation.

## Scope boundaries (explicitly out of this spec)

- `/orders/[orderId]` (individual Order Tracking) **stays guest-accessible**
  — a guest reaches it right after Checkout today (guest checkout is real,
  no login required); only the Order History *list* at `/orders` is gated.
- No new "Log In" entry point is added anywhere else in the customer UI
  beyond what already exists (Landing, and now the redirect itself) — out
  of scope for this spec.
- Fixing `ProfileView`'s hardcoded mock name/phone/email data itself is
  **not** in scope — that remains a known, documented mock (no `profiles`
  columns beyond `role` are read yet); this spec only adds the auth gate
  and the role-nav card/badge around it.
- No changes to `/staff/*` or `/admin/*` middleware behavior — those rules
  are untouched.

---

## Part 1: Auth gate (`middleware.ts`)

Add a new exact-path list, separate from the existing prefix-based
`ROUTE_GROUP_ROLES`:

```ts
const AUTH_REQUIRED_EXACT_PATHS = ["/profile", "/orders", "/loyalty"]
```

In `resolveRedirect(pathname, role)`, before the existing
`ADMIN_ONLY_PREFIXES`/`ROUTE_GROUP_ROLES` checks: if `pathname` exactly
equals one of `AUTH_REQUIRED_EXACT_PATHS` and `role` is `null`, return
`"/login"`. Any authenticated role (`customer`/`staff`/`manager`/`admin`)
passes through — this check is "must be logged in," not role-restrictive
like `/staff`/`/admin`.

**Exact match, not `startsWith`, is the load-bearing detail** — it's what
lets `/orders` redirect a guest while `/orders/abc123` (Order Tracking)
stays reachable. `resolveRedirect` already receives the locale-stripped
`rest` path (via `splitLocaleFromPathname`), so `"/orders"` here means
literally the Order History list route, never a sub-path.

No new Supabase calls: `resolveRole(request)` already runs once per
request and its result is reused for this check, same as the existing
`/staff`/`/admin` checks.

## Part 2: Role plumbing + UI

### `lib/get-current-role.ts` (new)

A server-side helper mirroring middleware's `resolveRole()`, but built on
the existing `lib/supabase/server.ts` cookie-based client (safe to call
from a Server Component, unlike the `NextRequest`-based client middleware
uses):

```ts
export async function getCurrentRole(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
    return profile?.role ?? null
  } catch {
    return null
  }
}
```

Same fail-open-to-anonymous convention used everywhere else in the app
(returns `null` rather than throwing on an unreachable/misconfigured
Supabase).

### Call sites

- `app/[locale]/(marketing)/layout.tsx`, `(auth)/layout.tsx`,
  `(customer)/layout.tsx` — each already renders `<CustomerHeader />`;
  each calls `getCurrentRole()` and passes the result as a `role` prop.
- `app/[locale]/(customer)/profile/page.tsx` — calls `getCurrentRole()`
  and passes `role` into `<ProfileView role={role} />`.

Three call sites, not one shared fetch, because `CustomerHeader` is
rendered independently by three sibling layouts and Next.js layouts have
no mechanism to pass data to a *different* layout — only to their own
`children`. This mirrors the tradeoff already accepted for
`resolveRole()` being middleware-local.

### `CustomerHeader` changes

Add an optional `role?: string | null` prop. When `role` is `"staff"`,
`"manager"`, or `"admin"`, render a small pill on the right side of the
header (matching mockup `1d413b40d2904396862d12674d5863e9`'s placement,
next to where `LanguageSwitcher` sits) — icon + short label (e.g. "Staff"),
linking to `ROLE_HOME[role]` (`lib/roles.ts`). Uses Base UI's `render` prop
for the polymorphic link (`<Button render={<Link .../>} nativeButton={false}>`),
per this project's established `asChild`-replacement pattern. `role` of
`"customer"` or `null`: no badge, header unchanged from today.

### `ProfileView` changes

Add a `role: string | null` prop (passed from the new server wrapper).
When `role` is `"staff"`, `"manager"`, or `"admin"`, render the card from
mockup `4e4bcae94d9d422f97df6e41e18b6790` between the avatar/name section
and the editable fields section: secondary coffee-brown surface (not
primary red, to read as distinct from customer-facing actions), an icon,
a headline + subtext naming the role, and a filled button to
`ROLE_HOME[role]` — "Go to POS" for `staff`, "Go to Admin Dashboard" for
`manager`/`admin`. `role` of `"customer"`: no card, page unchanged from
today's (mock-data) behavior.

### Translations

New keys in both `messages/vi.json` and `messages/en.json`:

- `Profile` namespace gains the staff-access card's headline/subtext/button
  text, one set per role (`staff`/`manager`/`admin` — `manager` and `admin`
  share the same "Go to Admin Dashboard" copy since they share a
  `ROLE_HOME` destination).
- A new `RoleNav` namespace holds the header badge's label (e.g. "Staff" /
  "Nhân viên") — shared across `CustomerHeader`, not `Profile`-specific,
  since the badge is rendered from three different layouts.

Copy matches the bilingual strings already shown in the two approved
mockups.

---

## Testing

- `resolveRedirect`'s new exact-path branch is a pure function, same as
  today — add unit test cases (`middleware.test.ts`, new file) covering:
  guest hitting `/profile`/`/orders`/`/loyalty` → redirected to `/login`;
  any authenticated role hitting the same three paths → not redirected;
  guest or any role hitting `/orders/abc123` → not redirected (confirms
  the exact-match fix for the Order Tracking exception).
- Manual verification on the live Vercel deployment (per this project's
  standing "verify live, not localhost" preference), across all four
  roles plus a logged-out guest:
  - Guest visiting `/profile`, `/orders`, `/loyalty` → redirected to
    `/login`; `/orders/[orderId]` for an existing order id still loads.
  - `customer` role → all three pages load normally, no badge, no card
    (unchanged from today).
  - `staff` role → header badge appears on marketing/auth/customer pages,
    links to `/staff/pos`; Profile page shows the staff card with the same
    link.
  - `manager`/`admin` role → same, linking to `/admin/dashboard`.
