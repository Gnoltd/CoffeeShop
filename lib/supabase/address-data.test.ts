import { describe, it, expect, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getAddresses, addAddress, updateAddress, deleteAddress, setDefaultAddress } from "./address-data"

const ROW = { id: "addr-1", label: "Home", address: "123 Le Loi, D1", phone: "0900000000", is_default: true }

describe("getAddresses", () => {
  it("selects the customer's own addresses ordered default-first then oldest-first", async () => {
    const orderSpy2 = vi.fn(() => Promise.resolve({ data: [ROW], error: null }))
    const orderSpy1 = vi.fn(() => ({ order: orderSpy2 }))
    const eqSpy = vi.fn(() => ({ order: orderSpy1 }))
    const selectSpy = vi.fn(() => ({ eq: eqSpy }))
    const supabase = { from: () => ({ select: selectSpy }) } as unknown as SupabaseClient

    const result = await getAddresses(supabase, "user-1")

    expect(selectSpy).toHaveBeenCalledWith("id, label, address, phone, is_default")
    expect(eqSpy).toHaveBeenCalledWith("customer_id", "user-1")
    expect(orderSpy1).toHaveBeenCalledWith("is_default", { ascending: false })
    expect(orderSpy2).toHaveBeenCalledWith("created_at", { ascending: true })
    expect(result).toEqual([{ id: "addr-1", label: "Home", address: "123 Le Loi, D1", phone: "0900000000", isDefault: true }])
  })

  it("returns an empty array when the customer has no addresses", async () => {
    const supabase = {
      from: () => ({ select: () => ({ eq: () => ({ order: () => ({ order: () => Promise.resolve({ data: null, error: null }) }) }) }) }),
    } as unknown as SupabaseClient

    expect(await getAddresses(supabase, "user-1")).toEqual([])
  })
})

describe("addAddress", () => {
  it("inserts scoped to the customer id and returns the mapped row", async () => {
    const singleSpy = vi.fn(() => Promise.resolve({ data: ROW, error: null }))
    const selectSpy = vi.fn(() => ({ single: singleSpy }))
    const insertSpy = vi.fn(() => ({ select: selectSpy }))
    const supabase = { from: () => ({ insert: insertSpy }) } as unknown as SupabaseClient

    const result = await addAddress(supabase, "user-1", { label: "Home", address: "123 Le Loi, D1", phone: "0900000000" })

    expect(insertSpy).toHaveBeenCalledWith({
      customer_id: "user-1",
      label: "Home",
      address: "123 Le Loi, D1",
      phone: "0900000000",
    })
    expect(result.id).toBe("addr-1")
  })
})

describe("updateAddress", () => {
  it("updates the given address id", async () => {
    const eqSpy = vi.fn(() => Promise.resolve({ error: null }))
    const updateSpy = vi.fn(() => ({ eq: eqSpy }))
    const supabase = { from: () => ({ update: updateSpy }) } as unknown as SupabaseClient

    await updateAddress(supabase, "addr-1", { label: "Work", address: "456 Nguyen Hue", phone: "0911111111" })

    expect(updateSpy).toHaveBeenCalledWith({ label: "Work", address: "456 Nguyen Hue", phone: "0911111111" })
    expect(eqSpy).toHaveBeenCalledWith("id", "addr-1")
  })
})

describe("deleteAddress", () => {
  it("deletes the given address id", async () => {
    const eqSpy = vi.fn(() => Promise.resolve({ error: null }))
    const deleteSpy = vi.fn(() => ({ eq: eqSpy }))
    const supabase = { from: () => ({ delete: deleteSpy }) } as unknown as SupabaseClient

    await deleteAddress(supabase, "addr-1")

    expect(eqSpy).toHaveBeenCalledWith("id", "addr-1")
  })
})

describe("setDefaultAddress", () => {
  it("calls the RPC with the address id", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    await setDefaultAddress(supabase, "addr-1")

    expect(rpcSpy).toHaveBeenCalledWith("set_default_address", { p_address_id: "addr-1" })
  })

  it("throws when the RPC errors", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ error: new Error("boom") }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    await expect(setDefaultAddress(supabase, "addr-1")).rejects.toThrow("boom")
  })
})
