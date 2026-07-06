import { describe, it, expect, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getOrderForTracking,
  placeOrder,
  getMyOrders,
  getKitchenOrders,
  advanceOrderStatus,
  confirmCashPayment,
  cancelPendingOrder,
  getOrderHistory,
  getOrderHistoryDetail,
} from "./orders-data"

describe("getOrderForTracking", () => {
  it("calls the RPC and returns its jsonb result directly", async () => {
    const result = {
      id: "ord-1",
      createdAt: 1751800000000,
      orderType: "dine_in",
      table: "3",
      status: "preparing",
      subtotal: 50000,
      discount: 0,
      total: 50000,
      items: [{ nameVi: "Phin Sữa Đá", nameEn: "Iced Milk Coffee", quantity: 1, unitPrice: 50000, note: null }],
    }
    const rpcSpy = vi.fn(() => Promise.resolve({ data: result, error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    const order = await getOrderForTracking(supabase, "ord-1")

    expect(rpcSpy).toHaveBeenCalledWith("get_order_for_tracking", { p_order_id: "ord-1" })
    expect(order?.orderType).toBe("dine-in")
    expect(order?.table).toBe("3")
    expect(order?.status).toBe("preparing")
  })

  it("returns null when the RPC returns null (not found or not permitted)", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ data: null, error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    const order = await getOrderForTracking(supabase, "nonexistent")
    expect(order).toBeNull()
  })
})

describe("placeOrder", () => {
  it("maps camelCase input to the RPC's payload shape, translating order type", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ data: { orderId: "ord-new", total: 29000 }, error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    const result = await placeOrder(supabase, {
      orderType: "dine-in",
      tableId: "tbl-1",
      pickupTime: null,
      paymentMethod: "cash",
      promoCode: "WELCOME10",
      redeemLoyaltyPoints: 0,
      paymentCollected: false,
      items: [{ menuItemId: "item-1", sizeId: null, modifierIds: [], quantity: 2, note: "less sugar" }],
    })

    expect(rpcSpy).toHaveBeenCalledWith("place_order", {
      p_payload: {
        orderType: "dine_in",
        tableId: "tbl-1",
        pickupTime: null,
        paymentMethod: "cash",
        promoCode: "WELCOME10",
        redeemLoyaltyPoints: 0,
        paymentCollected: false,
        items: [{ menuItemId: "item-1", sizeId: null, modifierIds: [], quantity: 2, note: "less sugar" }],
      },
    })
    expect(result).toEqual({ orderId: "ord-new", total: 29000 })
  })
})

describe("getMyOrders", () => {
  it("maps nested rows, translating order_type back to hyphenated form", async () => {
    const row = {
      id: "ord-1",
      created_at: "2026-07-06T10:00:00.000Z",
      order_type: "dine_in",
      status: "completed",
      subtotal: 29000,
      discount_amount: 0,
      total: 29000,
      tables: { table_number: "2" },
      order_items: [{ quantity: 1, unit_price: 29000, note: null, menu_items: { name_vi: "a", name_en: "b" } }],
    }
    const supabase = {
      from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [row], error: null }) }) }),
    } as unknown as SupabaseClient

    const result = await getMyOrders(supabase)
    expect(result[0].orderType).toBe("dine-in")
    expect(result[0].table).toBe("2")
  })
})

describe("getKitchenOrders", () => {
  it("filters to paid/preparing/ready statuses", async () => {
    const inSpy = vi.fn(() => ({ order: () => Promise.resolve({ data: [], error: null }) }))
    const supabase = {
      from: () => ({ select: () => ({ in: inSpy }) }),
    } as unknown as SupabaseClient

    await getKitchenOrders(supabase)
    expect(inSpy).toHaveBeenCalledWith("status", ["paid", "preparing", "ready"])
  })
})

describe("advanceOrderStatus", () => {
  it("updates only the status column", async () => {
    const eqSpy = vi.fn(() => Promise.resolve({ error: null }))
    const updateSpy = vi.fn(() => ({ eq: eqSpy }))
    const supabase = { from: () => ({ update: updateSpy }) } as unknown as SupabaseClient

    await advanceOrderStatus(supabase, "ord-1", "ready")
    expect(updateSpy).toHaveBeenCalledWith({ status: "ready" })
    expect(eqSpy).toHaveBeenCalledWith("id", "ord-1")
  })
})

describe("confirmCashPayment", () => {
  it("updates both status and payment_status to paid", async () => {
    const eqSpy = vi.fn(() => Promise.resolve({ error: null }))
    const updateSpy = vi.fn(() => ({ eq: eqSpy }))
    const supabase = { from: () => ({ update: updateSpy }) } as unknown as SupabaseClient

    await confirmCashPayment(supabase, "ord-1")
    expect(updateSpy).toHaveBeenCalledWith({ status: "paid", payment_status: "paid" })
  })
})

describe("cancelPendingOrder", () => {
  it("calls the RPC with the order id and returns its boolean result", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ data: true, error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    const result = await cancelPendingOrder(supabase, "ord-1")

    expect(rpcSpy).toHaveBeenCalledWith("cancel_pending_order", { p_order_id: "ord-1" })
    expect(result).toBe(true)
  })

  it("returns false when the RPC reports the order wasn't cancellable", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ data: false, error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    const result = await cancelPendingOrder(supabase, "ord-2")
    expect(result).toBe(false)
  })
})

describe("getOrderHistory", () => {
  it("calls the RPC with snake_case params built from camelCase filters", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ data: { rows: [], totalCount: 0 }, error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    await getOrderHistory(
      supabase,
      { dateFrom: "2026-07-01", dateTo: "2026-07-07", statuses: ["completed"], orderType: "dine-in", search: "A1B2" },
      { limit: 20, offset: 0 }
    )

    expect(rpcSpy).toHaveBeenCalledWith("get_order_history", {
      p_date_from: "2026-07-01",
      p_date_to: "2026-07-07",
      p_statuses: ["completed"],
      p_order_type: "dine_in",
      p_search: "A1B2",
      p_limit: 20,
      p_offset: 0,
    })
  })

  it("omits order type and passes null search when not provided", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ data: { rows: [], totalCount: 0 }, error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    await getOrderHistory(supabase, {}, { limit: 20, offset: 0 })

    expect(rpcSpy).toHaveBeenCalledWith("get_order_history", {
      p_date_from: null,
      p_date_to: null,
      p_statuses: null,
      p_order_type: null,
      p_search: null,
      p_limit: 20,
      p_offset: 0,
    })
  })

  it("maps snake_case rows to camelCase, translating order_type and defaulting a null customer name to undefined", async () => {
    const row = {
      id: "ord-1",
      created_at: "2026-07-06T10:00:00.000Z",
      order_type: "dine_in",
      table_number: "5",
      customer_name: null,
      payment_method: "cash",
      status: "completed",
      total: 60000,
    }
    const rpcSpy = vi.fn(() => Promise.resolve({ data: { rows: [row], totalCount: 1 }, error: null }))
    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient

    const result = await getOrderHistory(supabase, {}, { limit: 20, offset: 0 })

    expect(result.totalCount).toBe(1)
    expect(result.rows[0]).toEqual({
      id: "ord-1",
      createdAt: new Date("2026-07-06T10:00:00.000Z").getTime(),
      orderType: "dine-in",
      table: "5",
      customerName: undefined,
      paymentMethod: "cash",
      status: "completed",
      total: 60000,
    })
  })
})

describe("getOrderHistoryDetail", () => {
  it("selects a single order by id with the staff detail shape and maps a guest's null profile to an undefined customerName", async () => {
    const row = {
      id: "ord-1",
      created_at: "2026-07-06T10:00:00.000Z",
      order_type: "pickup",
      status: "completed",
      subtotal: 60000,
      discount_amount: 0,
      total: 60000,
      payment_method: "cash",
      payment_status: "paid",
      tables: null,
      profiles: null,
      order_items: [{ quantity: 1, unit_price: 60000, note: null, menu_items: { name_vi: "a", name_en: "b" } }],
    }
    const singleSpy = vi.fn(() => Promise.resolve({ data: row, error: null }))
    const eqSpy = vi.fn(() => ({ single: singleSpy }))
    const selectSpy = vi.fn(() => ({ eq: eqSpy }))
    const supabase = { from: () => ({ select: selectSpy }) } as unknown as SupabaseClient

    const result = await getOrderHistoryDetail(supabase, "ord-1")

    expect(eqSpy).toHaveBeenCalledWith("id", "ord-1")
    expect(result?.customerName).toBeUndefined()
    expect(result?.paymentMethod).toBe("cash")
    expect(result?.paymentStatus).toBe("paid")
  })

  it("returns null when no matching row is found", async () => {
    const singleSpy = vi.fn(() => Promise.resolve({ data: null, error: { code: "PGRST116" } }))
    const supabase = {
      from: () => ({ select: () => ({ eq: () => ({ single: singleSpy }) }) }),
    } as unknown as SupabaseClient

    const result = await getOrderHistoryDetail(supabase, "unknown-id")
    expect(result).toBeNull()
  })
})
