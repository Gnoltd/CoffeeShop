import { describe, it, expect, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getShiftReport, getShiftHistory, openShift, closeShift, joinShift, leaveShift, isShiftOpen } from "./shift-data"

const SAMPLE_REPORT = {
  id: "shift-1",
  openedAt: 1752100000000,
  closedAt: null,
  openedByName: "Nguyen Van A",
  closedByName: null,
  plannedStartAt: null,
  plannedEndAt: null,
  startingCash: 500000,
  countedCash: null,
  notes: null,
  byMethod: [{ method: "cash", count: 2, total: 90000 }],
  expectedCash: 590000,
  difference: null,
  transactions: [{ id: "ord-1", paidAt: 1752101000000, paymentMethod: "cash", total: 45000 }],
  workers: [{ staffId: "staff-1", fullName: "Nguyen Van A", joinedAt: 1752100000000, leftAt: null }],
  itemsSold: [{ menuItemId: "item-1", nameVi: "Ca phe sua", nameEn: "Milk coffee", quantity: 3, revenue: 90000 }],
}

describe("getShiftReport", () => {
  it("calls the RPC with a null shift id (current open shift) by default", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ data: SAMPLE_REPORT, error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    const report = await getShiftReport(supabase)

    expect(rpcSpy).toHaveBeenCalledWith("get_shift_report", { p_shift_id: null })
    expect(report?.expectedCash).toBe(590000)
    expect(report?.byMethod[0].method).toBe("cash")
    expect(report?.openedByName).toBe("Nguyen Van A")
    expect(report?.workers).toHaveLength(1)
    expect(report?.itemsSold[0].quantity).toBe(3)
  })

  it("passes a specific shift id through to fetch a past shift's report", async () => {
    const closed = { ...SAMPLE_REPORT, id: "shift-9", closedAt: 1752110000000 }
    const rpcSpy = vi.fn(() => Promise.resolve({ data: closed, error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    const report = await getShiftReport(supabase, "shift-9")

    expect(rpcSpy).toHaveBeenCalledWith("get_shift_report", { p_shift_id: "shift-9" })
    expect(report?.id).toBe("shift-9")
  })

  it("returns null when no shift is open", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ data: null, error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    expect(await getShiftReport(supabase)).toBeNull()
  })
})

describe("getShiftHistory", () => {
  it("returns the list of past closed shifts", async () => {
    const history = [
      {
        id: "shift-9",
        openedAt: 1752100000000,
        closedAt: 1752110000000,
        openedByName: "Nguyen Van A",
        closedByName: "Tran Thi B",
        startingCash: 500000,
        countedCash: 585000,
        difference: -5000,
        totalRevenue: 120000,
      },
    ]
    const rpcSpy = vi.fn(() => Promise.resolve({ data: history, error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    const result = await getShiftHistory(supabase)

    expect(rpcSpy).toHaveBeenCalledWith("get_shift_history")
    expect(result).toHaveLength(1)
    expect(result[0].totalRevenue).toBe(120000)
    expect(result[0].closedByName).toBe("Tran Thi B")
  })

  it("returns an empty array when no shifts have ever been closed", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ data: null, error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    expect(await getShiftHistory(supabase)).toEqual([])
  })
})

describe("openShift", () => {
  it("passes starting cash and null planned times to the RPC when omitted", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ data: SAMPLE_REPORT, error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    const report = await openShift(supabase, 500000)

    expect(rpcSpy).toHaveBeenCalledWith("open_shift", {
      p_starting_cash: 500000,
      p_planned_start_at: null,
      p_planned_end_at: null,
    })
    expect(report.startingCash).toBe(500000)
  })

  it("converts planned start/end epoch ms to ISO strings", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ data: SAMPLE_REPORT, error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient
    const plannedStart = 1752100000000
    const plannedEnd = 1752130000000

    await openShift(supabase, 500000, plannedStart, plannedEnd)

    expect(rpcSpy).toHaveBeenCalledWith("open_shift", {
      p_starting_cash: 500000,
      p_planned_start_at: new Date(plannedStart).toISOString(),
      p_planned_end_at: new Date(plannedEnd).toISOString(),
    })
  })

  it("throws when the RPC errors (e.g. shift_already_open)", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ data: null, error: new Error("shift_already_open") }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    await expect(openShift(supabase, 500000)).rejects.toThrow("shift_already_open")
  })
})

describe("closeShift", () => {
  it("passes counted cash and notes to the RPC", async () => {
    const closed = { ...SAMPLE_REPORT, closedAt: 1752110000000, countedCash: 585000, difference: -5000 }
    const rpcSpy = vi.fn(() => Promise.resolve({ data: closed, error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    const report = await closeShift(supabase, 585000, "drawer short")

    expect(rpcSpy).toHaveBeenCalledWith("close_shift", { p_counted_cash: 585000, p_notes: "drawer short" })
    expect(report.difference).toBe(-5000)
  })

  it("sends null notes when omitted", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ data: SAMPLE_REPORT, error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    await closeShift(supabase, 585000)

    expect(rpcSpy).toHaveBeenCalledWith("close_shift", { p_counted_cash: 585000, p_notes: null })
  })
})

describe("joinShift", () => {
  it("calls the join_shift RPC and returns the refreshed report", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ data: SAMPLE_REPORT, error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    const report = await joinShift(supabase)

    expect(rpcSpy).toHaveBeenCalledWith("join_shift")
    expect(report.workers).toHaveLength(1)
  })

  it("throws when there is no open shift to join", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ data: null, error: new Error("no_open_shift") }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    await expect(joinShift(supabase)).rejects.toThrow("no_open_shift")
  })
})

describe("leaveShift", () => {
  it("calls the leave_shift RPC and returns the refreshed report", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ data: SAMPLE_REPORT, error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    await leaveShift(supabase)

    expect(rpcSpy).toHaveBeenCalledWith("leave_shift")
  })
})

describe("isShiftOpen", () => {
  it("returns true when a shift is open", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ data: true, error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    expect(await isShiftOpen(supabase)).toBe(true)
    expect(rpcSpy).toHaveBeenCalledWith("is_shift_open")
  })

  it("returns false when no shift is open", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ data: false, error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    expect(await isShiftOpen(supabase)).toBe(false)
  })
})
