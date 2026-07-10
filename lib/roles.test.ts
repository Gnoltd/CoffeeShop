import { describe, it, expect } from "vitest"
import { canAccessAdmin } from "./roles"

describe("canAccessAdmin", () => {
  it("returns true for manager", () => {
    expect(canAccessAdmin("manager")).toBe(true)
  })

  it("returns true for admin", () => {
    expect(canAccessAdmin("admin")).toBe(true)
  })

  it("returns false for staff", () => {
    expect(canAccessAdmin("staff")).toBe(false)
  })

  it("returns false for customer", () => {
    expect(canAccessAdmin("customer")).toBe(false)
  })

  it("returns false for null (logged out)", () => {
    expect(canAccessAdmin(null)).toBe(false)
  })
})
