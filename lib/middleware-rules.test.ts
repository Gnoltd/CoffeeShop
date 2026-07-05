import { describe, it, expect } from "vitest"
import { resolveRedirect } from "./middleware-rules"

describe("resolveRedirect — auth-required exact paths", () => {
  it("redirects an anonymous guest away from /profile", () => {
    expect(resolveRedirect("/profile", null)).toBe("/login")
  })

  it("redirects an anonymous guest away from /orders", () => {
    expect(resolveRedirect("/orders", null)).toBe("/login")
  })

  it("redirects an anonymous guest away from /loyalty", () => {
    expect(resolveRedirect("/loyalty", null)).toBe("/login")
  })

  it("allows a logged-in customer to reach /profile", () => {
    expect(resolveRedirect("/profile", "customer")).toBeNull()
  })

  it("allows a logged-in staff user to reach /orders", () => {
    expect(resolveRedirect("/orders", "staff")).toBeNull()
  })

  it("allows a logged-in admin to reach /loyalty", () => {
    expect(resolveRedirect("/loyalty", "admin")).toBeNull()
  })

  it("does not gate an individual order tracking page for a guest", () => {
    expect(resolveRedirect("/orders/abc123", null)).toBeNull()
  })
})

describe("resolveRedirect — existing /staff and /admin behavior unaffected", () => {
  it("still redirects an anonymous guest away from /staff/pos", () => {
    expect(resolveRedirect("/staff/pos", null)).toBe("/login")
  })

  it("still redirects a customer away from /admin/dashboard", () => {
    expect(resolveRedirect("/admin/dashboard", "customer")).toBe("/menu")
  })
})
