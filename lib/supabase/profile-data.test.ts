import { describe, it, expect, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getProfile, updateProfile } from "./profile-data"

describe("getProfile", () => {
  it("selects full_name and phone for the given user id, defaulting nulls to empty strings", async () => {
    const singleSpy = vi.fn(() => Promise.resolve({ data: { full_name: "Nguyễn Văn An", phone: null }, error: null }))
    const eqSpy = vi.fn(() => ({ single: singleSpy }))
    const selectSpy = vi.fn(() => ({ eq: eqSpy }))
    const supabase = { from: () => ({ select: selectSpy }) } as unknown as SupabaseClient

    const profile = await getProfile(supabase, "user-1")

    expect(selectSpy).toHaveBeenCalledWith("full_name, phone")
    expect(eqSpy).toHaveBeenCalledWith("id", "user-1")
    expect(profile).toEqual({ fullName: "Nguyễn Văn An", phone: "" })
  })

  it("throws when the query errors", async () => {
    const singleSpy = vi.fn(() => Promise.resolve({ data: null, error: new Error("boom") }))
    const supabase = {
      from: () => ({ select: () => ({ eq: () => ({ single: singleSpy }) }) }),
    } as unknown as SupabaseClient

    await expect(getProfile(supabase, "user-1")).rejects.toThrow("boom")
  })
})

describe("updateProfile", () => {
  it("updates only the provided fields, mapped to snake_case columns", async () => {
    const eqSpy = vi.fn(() => Promise.resolve({ error: null }))
    const updateSpy = vi.fn(() => ({ eq: eqSpy }))
    const supabase = { from: () => ({ update: updateSpy }) } as unknown as SupabaseClient

    await updateProfile(supabase, "user-1", { fullName: "New Name" })

    expect(updateSpy).toHaveBeenCalledWith({ full_name: "New Name" })
    expect(eqSpy).toHaveBeenCalledWith("id", "user-1")
  })

  it("maps phone the same way", async () => {
    const eqSpy = vi.fn(() => Promise.resolve({ error: null }))
    const updateSpy = vi.fn(() => ({ eq: eqSpy }))
    const supabase = { from: () => ({ update: updateSpy }) } as unknown as SupabaseClient

    await updateProfile(supabase, "user-1", { phone: "+84 901 234 567" })

    expect(updateSpy).toHaveBeenCalledWith({ phone: "+84 901 234 567" })
  })

  it("throws when the update errors", async () => {
    const eqSpy = vi.fn(() => Promise.resolve({ error: new Error("rls denied") }))
    const supabase = { from: () => ({ update: () => ({ eq: eqSpy }) }) } as unknown as SupabaseClient

    await expect(updateProfile(supabase, "user-1", { fullName: "X" })).rejects.toThrow("rls denied")
  })
})
