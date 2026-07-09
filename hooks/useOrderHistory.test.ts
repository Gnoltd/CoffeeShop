import { describe, it, expect } from "vitest"
import { buildDateRange } from "./useOrderHistory"

describe("buildDateRange", () => {
  it("leaves both bounds unset when neither is given (all time, no default window)", () => {
    expect(buildDateRange(undefined, undefined)).toEqual({ dateFrom: undefined, dateTo: undefined })
  })

  it("passes a single bound through unchanged", () => {
    expect(buildDateRange("2026-07-01", undefined)).toEqual({ dateFrom: "2026-07-01", dateTo: undefined })
  })

  it("passes both bounds through unchanged when from <= to", () => {
    expect(buildDateRange("2026-07-01", "2026-07-07")).toEqual({ dateFrom: "2026-07-01", dateTo: "2026-07-07" })
  })

  it("swaps an inverted range instead of erroring", () => {
    expect(buildDateRange("2026-07-07", "2026-07-01")).toEqual({ dateFrom: "2026-07-01", dateTo: "2026-07-07" })
  })
})
