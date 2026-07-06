import { describe, it, expect, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getTables, createTable, regenerateQrToken, incrementScanCount, getTableByToken } from "./tables-data"

describe("getTables", () => {
  it("maps snake_case DB rows to camelCase TableRecord", async () => {
    const row = {
      id: "tbl-1",
      table_number: "1",
      qr_code_token: "abc123",
      location_vi: "Khu vực cửa sổ",
      location_en: "Window Area",
      is_occupied: false,
      scan_count: 3,
    }
    const supabase = {
      from: () => ({
        select: () => ({
          order: () => Promise.resolve({ data: [row], error: null }),
        }),
      }),
    } as unknown as SupabaseClient

    const result = await getTables(supabase)

    expect(result).toEqual([
      {
        id: "tbl-1",
        number: "1",
        qrToken: "abc123",
        locationVi: "Khu vực cửa sổ",
        locationEn: "Window Area",
        isOccupied: false,
        scanCount: 3,
      },
    ])
  })
})

describe("createTable", () => {
  it("inserts snake_case columns and returns the mapped row", async () => {
    const insertedRow = {
      id: "tbl-new",
      table_number: "7",
      qr_code_token: "def456",
      location_vi: "Sân vườn",
      location_en: "Garden",
      is_occupied: false,
      scan_count: 0,
    }
    const insertSpy = vi.fn(() => ({
      select: () => ({ single: () => Promise.resolve({ data: insertedRow, error: null }) }),
    }))
    const supabase = { from: () => ({ insert: insertSpy }) } as unknown as SupabaseClient

    const result = await createTable(supabase, { number: "7", locationVi: "Sân vườn", locationEn: "Garden" })

    expect(insertSpy).toHaveBeenCalledWith({
      table_number: "7",
      location_vi: "Sân vườn",
      location_en: "Garden",
    })
    expect(result.number).toBe("7")
    expect(result.qrToken).toBe("def456")
  })

  it("propagates a unique-constraint error instead of swallowing it", async () => {
    const insertSpy = vi.fn(() => ({
      select: () => ({
        single: () => Promise.resolve({ data: null, error: { message: "duplicate key value violates unique constraint" } }),
      }),
    }))
    const supabase = { from: () => ({ insert: insertSpy }) } as unknown as SupabaseClient

    await expect(createTable(supabase, { number: "1", locationVi: "", locationEn: "" })).rejects.toBeTruthy()
  })
})

describe("regenerateQrToken", () => {
  it("calls the regenerate_table_qr_token RPC with the right argument name", async () => {
    const row = {
      id: "tbl-1",
      table_number: "1",
      qr_code_token: "newtoken",
      location_vi: "",
      location_en: "",
      is_occupied: false,
      scan_count: 0,
    }
    const rpcSpy = vi.fn(() => Promise.resolve({ data: row, error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    const result = await regenerateQrToken(supabase, "tbl-1")

    expect(rpcSpy).toHaveBeenCalledWith("regenerate_table_qr_token", { p_table_id: "tbl-1" })
    expect(result.qrToken).toBe("newtoken")
  })
})

describe("incrementScanCount", () => {
  it("calls the increment_table_scan_count RPC with the right argument name", async () => {
    const row = {
      id: "tbl-1",
      table_number: "1",
      qr_code_token: "abc",
      location_vi: "",
      location_en: "",
      is_occupied: false,
      scan_count: 4,
    }
    const rpcSpy = vi.fn(() => Promise.resolve({ data: row, error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    const result = await incrementScanCount(supabase, "tbl-1")

    expect(rpcSpy).toHaveBeenCalledWith("increment_table_scan_count", { p_table_id: "tbl-1" })
    expect(result.scanCount).toBe(4)
  })
})

describe("getTableByToken", () => {
  it("returns null when no table matches the token", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      }),
    } as unknown as SupabaseClient

    const result = await getTableByToken(supabase, "nonexistent-token")
    expect(result).toBeNull()
  })
})
