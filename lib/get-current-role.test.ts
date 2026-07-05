import { describe, it, expect } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getCurrentRole } from "./get-current-role"

function fakeSupabase({ user, role }: { user: { id: string } | null; role?: string | null }) {
  return {
    auth: {
      getUser: () => Promise.resolve({ data: { user } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: user ? { role: role ?? null } : null }),
        }),
      }),
    }),
  } as unknown as SupabaseClient
}

describe("getCurrentRole", () => {
  it("returns null when there is no logged-in user", async () => {
    const supabase = fakeSupabase({ user: null })
    expect(await getCurrentRole(supabase)).toBeNull()
  })

  it("returns the profile's role for a logged-in user", async () => {
    const supabase = fakeSupabase({ user: { id: "user-1" }, role: "staff" })
    expect(await getCurrentRole(supabase)).toBe("staff")
  })

  it("returns null if the auth/profile lookup throws", async () => {
    const supabase = {
      auth: { getUser: () => Promise.reject(new Error("network down")) },
    } as unknown as SupabaseClient
    expect(await getCurrentRole(supabase)).toBeNull()
  })
})
