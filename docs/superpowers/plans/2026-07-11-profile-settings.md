# Profile Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Profile's "Settings" row real: a new `/profile/settings` page where a logged-in customer can change their password and connect/disconnect Google.

**Architecture:** A new route + client component calling `supabase.auth.updateUser({ password })` and `supabase.auth.{getUserIdentities,linkIdentity,unlinkIdentity}` directly (matching the existing Login/Signup pattern — no query-layer wrapper, since these are raw Auth SDK calls with no data mapping). Middleware gains the new path in its existing guest-gate list. The shared customer layout already provides the header + back button for free.

**Tech Stack:** Next.js App Router client components, `@supabase/ssr` browser client, next-intl, Vitest.

## Global Constraints

- **User-side prerequisite**: "Manual linking" must be enabled in the Supabase Dashboard (Authentication → configuration) before `linkIdentity()` will work — no MCP tool for this, same category as the Google OAuth provider setup.
- New strings in **both** `messages/en.json` and `messages/vi.json`.
- "Unlink" is only ever rendered enabled when `identities.length > 1` — Supabase's own documented rule (never build custom lockout-prevention logic on top of it).
- Verify against `https://phadincoffee.vercel.app`, not just `next build`.

---

### Task 1: Middleware gating (TDD)

**Files:**
- Modify: `lib/middleware-rules.ts`
- Test: `lib/middleware-rules.test.ts`

**Interfaces:**
- Produces: `/profile/settings` added to `AUTH_REQUIRED_EXACT_PATHS`. No new exports.

- [ ] **Step 1: Write the failing tests**

Append to `lib/middleware-rules.test.ts`, inside the existing `describe("resolveRedirect — auth-required exact paths", ...)` block (after the `"does not gate an individual order tracking page for a guest"` test):

```ts
  it("redirects an anonymous guest away from /profile/settings", () => {
    expect(resolveRedirect("/profile/settings", null)).toBe("/login")
  })

  it("allows a logged-in customer to reach /profile/settings", () => {
    expect(resolveRedirect("/profile/settings", "customer")).toBeNull()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/middleware-rules.test.ts`
Expected: FAIL — both new assertions fail because `/profile/settings` isn't in `AUTH_REQUIRED_EXACT_PATHS` yet, so `resolveRedirect` returns `null` for the guest case instead of `"/login"`.

- [ ] **Step 3: Implement**

In `lib/middleware-rules.ts`, change:

```ts
export const AUTH_REQUIRED_EXACT_PATHS = ["/profile", "/orders", "/loyalty"]
```

to:

```ts
export const AUTH_REQUIRED_EXACT_PATHS = ["/profile", "/profile/settings", "/orders", "/loyalty"]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/middleware-rules.test.ts`
Expected: PASS (all existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add lib/middleware-rules.ts lib/middleware-rules.test.ts
git commit -m "Gate /profile/settings behind login, matching /profile"
```

---

### Task 2: i18n keys

**Files:**
- Modify: `messages/en.json`, `messages/vi.json` (`Customer` and `Profile` namespaces)

**Interfaces:**
- Produces: `Customer.settingsTitle`; `Profile.{changePasswordTitle, newPasswordLabel, confirmPasswordLabel, passwordMismatchError, passwordTooShortError, passwordUpdateSuccess, passwordUpdateError, updatePasswordButton, connectedAccountsTitle, connectedLabel, connectGoogleButton, unlinkButton, connectGoogleError, unlinkError}`. Task 3 consumes all of these.

- [ ] **Step 1: Add `Customer.settingsTitle` to `messages/en.json`**

Change:

```json
    "profileTitle": "Profile",
    "loyaltyTitle": "Loyalty Points"
  },
```

to:

```json
    "profileTitle": "Profile",
    "loyaltyTitle": "Loyalty Points",
    "settingsTitle": "Settings"
  },
```

- [ ] **Step 2: Add `Customer.settingsTitle` to `messages/vi.json`**

Change:

```json
    "profileTitle": "Cá Nhân",
    "loyaltyTitle": "Điểm Tích Lũy"
  },
```

to:

```json
    "profileTitle": "Cá Nhân",
    "loyaltyTitle": "Điểm Tích Lũy",
    "settingsTitle": "Cài Đặt"
  },
```

- [ ] **Step 3: Add the new `Profile` namespace keys to `messages/en.json`**

Change:

```json
    "staffAccessHeadlineAdmin": "Admin Account",
    "staffAccessSubtextAdmin": "You have administrative access.",
    "staffAccessButtonAdmin": "Go to Admin Dashboard"
  },
```

to:

```json
    "staffAccessHeadlineAdmin": "Admin Account",
    "staffAccessSubtextAdmin": "You have administrative access.",
    "staffAccessButtonAdmin": "Go to Admin Dashboard",
    "changePasswordTitle": "Change Password",
    "newPasswordLabel": "New Password",
    "confirmPasswordLabel": "Confirm Password",
    "passwordMismatchError": "Passwords don't match.",
    "passwordTooShortError": "Password must be at least 6 characters.",
    "passwordUpdateSuccess": "Password updated.",
    "passwordUpdateError": "Couldn't update password — please try again.",
    "updatePasswordButton": "Update Password",
    "connectedAccountsTitle": "Connected Accounts",
    "connectedLabel": "Connected",
    "connectGoogleButton": "Connect Google",
    "unlinkButton": "Unlink",
    "connectGoogleError": "Couldn't connect Google — please try again.",
    "unlinkError": "Couldn't disconnect — please try again."
  },
```

- [ ] **Step 4: Add the new `Profile` namespace keys to `messages/vi.json`**

Change:

```json
    "staffAccessHeadlineAdmin": "Tài Khoản Quản Trị",
    "staffAccessSubtextAdmin": "Bạn có quyền quản trị hệ thống.",
    "staffAccessButtonAdmin": "Đến Bảng Điều Khiển"
  },
```

to:

```json
    "staffAccessHeadlineAdmin": "Tài Khoản Quản Trị",
    "staffAccessSubtextAdmin": "Bạn có quyền quản trị hệ thống.",
    "staffAccessButtonAdmin": "Đến Bảng Điều Khiển",
    "changePasswordTitle": "Đổi Mật Khẩu",
    "newPasswordLabel": "Mật Khẩu Mới",
    "confirmPasswordLabel": "Xác Nhận Mật Khẩu",
    "passwordMismatchError": "Mật khẩu không khớp.",
    "passwordTooShortError": "Mật khẩu phải có ít nhất 6 ký tự.",
    "passwordUpdateSuccess": "Đã cập nhật mật khẩu.",
    "passwordUpdateError": "Không thể cập nhật mật khẩu — vui lòng thử lại.",
    "updatePasswordButton": "Cập Nhật Mật Khẩu",
    "connectedAccountsTitle": "Tài Khoản Liên Kết",
    "connectedLabel": "Đã Liên Kết",
    "connectGoogleButton": "Liên Kết Google",
    "unlinkButton": "Hủy Liên Kết",
    "connectGoogleError": "Không thể liên kết Google — vui lòng thử lại.",
    "unlinkError": "Không thể hủy liên kết — vui lòng thử lại."
  },
```

- [ ] **Step 5: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json')); JSON.parse(require('fs').readFileSync('messages/vi.json')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 6: Commit**

```bash
git add messages/en.json messages/vi.json
git commit -m "Add Profile Settings translation keys"
```

---

### Task 3: `/profile/settings` route + `ProfileSettingsView`

**Files:**
- Create: `components/customer/profile-settings-view.tsx`
- Create: `app/[locale]/(customer)/profile/settings/page.tsx`

**Interfaces:**
- Consumes: i18n keys from Task 2.
- Produces: route `/​<locale>​/profile/settings`. Task 4's link points here.

- [ ] **Step 1: Write the component**

Create `components/customer/profile-settings-view.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import type { UserIdentity } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

export function ProfileSettingsView() {
  const t = useTranslations("Profile")
  const locale = useLocale()
  const searchParams = useSearchParams()

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  const [identities, setIdentities] = useState<UserIdentity[]>([])
  const [identitiesError, setIdentitiesError] = useState<string | null>(null)
  const [isLoadingIdentities, setIsLoadingIdentities] = useState(true)

  function loadIdentities() {
    const supabase = createClient()
    supabase.auth.getUserIdentities().then(({ data, error }) => {
      if (!error && data) setIdentities(data.identities)
      setIsLoadingIdentities(false)
    })
  }

  useEffect(() => {
    const oauthError = searchParams.get("error_description") ?? searchParams.get("error")
    if (oauthError) setIdentitiesError(oauthError)
    loadIdentities()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handlePasswordUpdate() {
    setPasswordError(null)
    setPasswordSuccess(false)
    if (newPassword.length < 6) {
      setPasswordError(t("passwordTooShortError"))
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("passwordMismatchError"))
      return
    }
    setIsSavingPassword(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setIsSavingPassword(false)
    if (error) {
      setPasswordError(t("passwordUpdateError"))
      return
    }
    setNewPassword("")
    setConfirmPassword("")
    setPasswordSuccess(true)
  }

  async function handleConnectGoogle() {
    const supabase = createClient()
    await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/${locale}/profile/settings` },
    })
  }

  async function handleUnlinkGoogle(identity: UserIdentity) {
    setIdentitiesError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.unlinkIdentity(identity)
    if (error) {
      setIdentitiesError(t("unlinkError"))
      return
    }
    loadIdentities()
  }

  const googleIdentity = identities.find((i) => i.provider === "google")

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-4">
      <section className="mb-6 rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-card-foreground">{t("changePasswordTitle")}</h2>
        {passwordError && (
          <p className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{passwordError}</p>
        )}
        {passwordSuccess && (
          <p className="mb-3 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{t("passwordUpdateSuccess")}</p>
        )}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block px-1 text-xs font-medium text-muted-foreground">{t("newPasswordLabel")}</label>
            <input
              type="password"
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-11 w-full rounded-xl border border-input bg-background px-4 text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block px-1 text-xs font-medium text-muted-foreground">
              {t("confirmPasswordLabel")}
            </label>
            <input
              type="password"
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-11 w-full rounded-xl border border-input bg-background px-4 text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <Button onClick={handlePasswordUpdate} disabled={isSavingPassword} className="h-11 w-full rounded-xl">
            {t("updatePasswordButton")}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-card-foreground">{t("connectedAccountsTitle")}</h2>
        {identitiesError && (
          <p className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{identitiesError}</p>
        )}
        {!isLoadingIdentities && (
          <div className="flex items-center justify-between rounded-xl border p-3">
            <span className="font-medium text-card-foreground">Google</span>
            {googleIdentity ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-primary">{t("connectedLabel")}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={identities.length <= 1}
                  onClick={() => handleUnlinkGoogle(googleIdentity)}
                >
                  {t("unlinkButton")}
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={handleConnectGoogle}>
                {t("connectGoogleButton")}
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Write the page**

Create `app/[locale]/(customer)/profile/settings/page.tsx`:

```tsx
import { getTranslations } from "next-intl/server"
import { ProfileSettingsView } from "@/components/customer/profile-settings-view"

export default async function ProfileSettingsPage() {
  const t = await getTranslations("Customer")
  return (
    <>
      <h1 className="sr-only">{t("settingsTitle")}</h1>
      <ProfileSettingsView />
    </>
  )
}
```

- [ ] **Step 3: Build to catch type errors**

Run: `npm run build`
Expected: succeeds with no TypeScript errors, and the route list includes `/[locale]/profile/settings`.

- [ ] **Step 4: Commit**

```bash
git add components/customer/profile-settings-view.tsx "app/[locale]/(customer)/profile/settings/page.tsx"
git commit -m "Add Profile Settings page: change password, connect/disconnect Google"
```

---

### Task 4: Enable the Settings row on Profile

**Files:**
- Modify: `components/customer/profile-view.tsx`

**Interfaces:**
- Consumes: `/profile/settings` route (Task 3).

- [ ] **Step 1: Replace the disabled button with a real link**

Change:

```tsx
        <button
          type="button"
          disabled
          title="Not implemented yet — no customer settings page"
          className="flex w-full items-center justify-between border-b p-4 text-left opacity-50"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Settings className="h-5 w-5" />
            </span>
            <span className="font-medium text-card-foreground">{t("menuSettings")}</span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
```

to:

```tsx
        <Link
          href="/profile/settings"
          className="flex items-center justify-between border-b p-4 transition-colors hover:bg-muted"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Settings className="h-5 w-5" />
            </span>
            <span className="font-medium text-card-foreground">{t("menuSettings")}</span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
```

(`Link` is already imported at the top of this file — no new import needed.)

- [ ] **Step 2: Build to catch type errors**

Run: `npm run build`
Expected: succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add components/customer/profile-view.tsx
git commit -m "Enable Profile's Settings row"
```

---

### Task 5: Full verification, deploy, live-verify

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npm run test`
Expected: all pass (existing count + 2 new from Task 1).

- [ ] **Step 2: Full build**

Run: `npm run build`
Expected: clean, no errors.

- [ ] **Step 3: Push**

```bash
git push
```

- [ ] **Step 4: Confirm the Supabase Dashboard prerequisite**

Before live-verifying the "Connect Google" path, confirm "manual linking" is enabled in the Supabase Dashboard (Authentication → configuration) — this is a one-time manual step outside this plan's control.

- [ ] **Step 5: Live-verify on `https://phadincoffee.vercel.app`**

1. As a logged-in customer, open Profile → Settings — confirm it navigates to `/​<locale>​/profile/settings` (not disabled anymore) and the back button (from the shared customer header) returns to Profile.
2. Change password: enter a new password (6+ chars) + matching confirm, submit, confirm the success message. Log out, log back in with the **new** password (and confirm the **old** one no longer works).
3. Connect Google: from an email/password account with no Google identity, tap "Connect Google," complete the real Google consent screen, confirm it lands back on `/profile/settings` showing Google as "Connected." Log out, confirm that account can now also log in via the Google button.
4. Attempt to unlink while only one identity exists (e.g. a fresh account with only email, no Google connected yet) — confirm no "Unlink" button is shown at all (since there's no Google identity to unlink in that state).
5. With Google connected (2 identities total), confirm the "Unlink" button is now enabled; tap it, confirm Google shows "Connect Google" again, and confirm that account can no longer log in via Google (only email/password).
6. While logged out, attempt to visit `/profile/settings` directly — confirm the middleware redirect to `/login` fires (matching `/profile`'s existing behavior).

- [ ] **Step 6: `daily.md` — leave as-is unless verification caught a real bug**

Per this project's current convention (`daily.md` trimmed to open work only), don't add a shipped-feature narrative entry unless something is left unresolved.
