import { describe, expect, it } from "vitest"

import { SPOTLIGHT_R, spotlightMask } from "./spotlight-mask"

describe("spotlightMask", () => {
  it("exports the design-spec radius", () => {
    expect(SPOTLIGHT_R).toBe(260)
  })

  it("centers the gradient at the given coordinates with the default radius", () => {
    expect(spotlightMask(120, 340)).toContain("circle 260px at 120px 340px")
  })

  it("produces the exact six soft-edge stops from the design spec", () => {
    expect(spotlightMask(0, 0)).toBe(
      "radial-gradient(circle 260px at 0px 0px, " +
        "rgba(255,255,255,1) 0%, " +
        "rgba(255,255,255,1) 40%, " +
        "rgba(255,255,255,0.75) 60%, " +
        "rgba(255,255,255,0.4) 75%, " +
        "rgba(255,255,255,0.12) 88%, " +
        "rgba(255,255,255,0) 100%)"
    )
  })

  it("accepts a custom radius", () => {
    expect(spotlightMask(10, 20, 100)).toContain("circle 100px at 10px 20px")
  })
})
