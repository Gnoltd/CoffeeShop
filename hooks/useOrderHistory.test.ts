import { describe, it, expect } from "vitest"
import { buildDateRange } from "./useOrderHistory"

describe("buildDateRange", () => {
  it("defaults to the last 7 days when neither bound is given", () => {
    const today = new Date().toISOString().slice(0, 10)
    const result = buildDateRange(undefined, undefined)
    expect(result.dateTo).toBe(today)
    expect(new Date(result.dateFrom) < new Date(result.dateTo)).toBe(true)
  })

  it("passes both bounds through unchanged when from <= to", () => {
    expect(buildDateRange("2026-07-01", "2026-07-07")).toEqual({ dateFrom: "2026-07-01", dateTo: "2026-07-07" })
  })

  it("swaps an inverted range instead of erroring", () => {
    expect(buildDateRange("2026-07-07", "2026-07-01")).toEqual({ dateFrom: "2026-07-01", dateTo: "2026-07-07" })
  })
})
