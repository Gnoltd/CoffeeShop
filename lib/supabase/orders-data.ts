import type { SupabaseClient } from "@supabase/supabase-js"

export type RealOrderStatus = "pending_payment" | "paid" | "preparing" | "ready" | "completed" | "cancelled"
export type RealOrderType = "pickup" | "dine_in"
export type OrderType = "pickup" | "dine-in"

export type OrderForTrackingItem = { nameVi: string; nameEn: string; quantity: number; unitPrice: number; note?: string }

export type OrderForTracking = {
  id: string
  createdAt: number
  orderType: OrderType
  table?: string
  items: OrderForTrackingItem[]
  subtotal: number
  discount: number
  total: number
  status: RealOrderStatus
}

export type PlaceOrderItemInput = {
  menuItemId: string
  sizeId?: string | null
  modifierIds: string[]
  quantity: number
  note?: string | null
}

export type PlaceOrderInput = {
  orderType: OrderType
  tableId?: string | null
  pickupTime?: string | null
  paymentMethod: "cash"
  promoCode?: string | null
  redeemLoyaltyPoints?: number
  paymentCollected?: boolean
  items: PlaceOrderItemInput[]
}

function toRealOrderType(orderType: OrderType): RealOrderType {
  return orderType === "dine-in" ? "dine_in" : "pickup"
}

function fromRealOrderType(orderType: RealOrderType): OrderType {
  return orderType === "dine_in" ? "dine-in" : "pickup"
}

type TrackingJsonItem = { nameVi: string; nameEn: string; quantity: number; unitPrice: number; note: string | null }

type TrackingJson = {
  id: string
  createdAt: number
  orderType: RealOrderType
  table: string | null
  status: RealOrderStatus
  subtotal: number
  discount: number
  total: number
  items: TrackingJsonItem[]
}

function mapTrackingJson(json: TrackingJson): OrderForTracking {
  return {
    id: json.id,
    createdAt: json.createdAt,
    orderType: fromRealOrderType(json.orderType),
    table: json.table ?? undefined,
    items: json.items.map((item) => ({ ...item, note: item.note ?? undefined })),
    subtotal: json.subtotal,
    discount: json.discount,
    total: json.total,
    status: json.status,
  }
}

export async function placeOrder(
  supabase: SupabaseClient,
  input: PlaceOrderInput
): Promise<{ orderId: string; total: number }> {
  const { data, error } = await supabase.rpc("place_order", {
    p_payload: {
      orderType: toRealOrderType(input.orderType),
      tableId: input.tableId ?? null,
      pickupTime: input.pickupTime ?? null,
      paymentMethod: input.paymentMethod,
      promoCode: input.promoCode ?? null,
      redeemLoyaltyPoints: input.redeemLoyaltyPoints ?? 0,
      paymentCollected: input.paymentCollected ?? false,
      items: input.items.map((item) => ({
        menuItemId: item.menuItemId,
        sizeId: item.sizeId ?? null,
        modifierIds: item.modifierIds,
        quantity: item.quantity,
        note: item.note ?? null,
      })),
    },
  })
  if (error) throw error
  return data as { orderId: string; total: number }
}

export async function getOrderForTracking(supabase: SupabaseClient, orderId: string): Promise<OrderForTracking | null> {
  const { data, error } = await supabase.rpc("get_order_for_tracking", { p_order_id: orderId })
  if (error) throw error
  return data ? mapTrackingJson(data as TrackingJson) : null
}

type OrderRow = {
  id: string
  created_at: string
  order_type: RealOrderType
  status: RealOrderStatus
  subtotal: number
  discount_amount: number
  total: number
  tables: { table_number: string } | null
  order_items: { menu_items: { name_vi: string; name_en: string }; quantity: number; unit_price: number; note: string | null }[]
}

const ORDER_SELECT = `
  id, created_at, order_type, status, subtotal, discount_amount, total,
  tables ( table_number ),
  order_items ( quantity, unit_price, note, menu_items ( name_vi, name_en ) )
`

function mapOrderRow(row: OrderRow): OrderForTracking {
  return {
    id: row.id,
    createdAt: new Date(row.created_at).getTime(),
    orderType: fromRealOrderType(row.order_type),
    table: row.tables?.table_number,
    items: row.order_items.map((oi) => ({
      nameVi: oi.menu_items.name_vi,
      nameEn: oi.menu_items.name_en,
      quantity: oi.quantity,
      unitPrice: oi.unit_price,
      note: oi.note ?? undefined,
    })),
    subtotal: row.subtotal,
    discount: row.discount_amount,
    total: row.total,
    status: row.status,
  }
}

export async function getMyOrders(supabase: SupabaseClient): Promise<OrderForTracking[]> {
  const { data, error } = await supabase.from("orders").select(ORDER_SELECT).order("created_at", { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown as OrderRow[]).map(mapOrderRow)
}

export type KdsOrderItemRow = { nameVi: string; nameEn: string; quantity: number; note: string | null }
export type KdsOrderRow = {
  id: string
  orderType: OrderType
  table?: string
  status: RealOrderStatus
  createdAt: number
  items: KdsOrderItemRow[]
}

function mapKdsRow(row: OrderRow): KdsOrderRow {
  return {
    id: row.id,
    orderType: fromRealOrderType(row.order_type),
    table: row.tables?.table_number,
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
    items: row.order_items.map((oi) => ({
      nameVi: oi.menu_items.name_vi,
      nameEn: oi.menu_items.name_en,
      quantity: oi.quantity,
      note: oi.note,
    })),
  }
}

export async function getKitchenOrders(supabase: SupabaseClient): Promise<KdsOrderRow[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .in("status", ["paid", "preparing", "ready"])
    .order("created_at")
  if (error) throw error
  return ((data ?? []) as unknown as OrderRow[]).map(mapKdsRow)
}

export async function getPendingPaymentOrders(supabase: SupabaseClient): Promise<KdsOrderRow[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("status", "pending_payment")
    .eq("payment_method", "cash")
    .order("created_at")
  if (error) throw error
  return ((data ?? []) as unknown as OrderRow[]).map(mapKdsRow)
}

export async function advanceOrderStatus(
  supabase: SupabaseClient,
  orderId: string,
  newStatus: RealOrderStatus
): Promise<void> {
  const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", orderId)
  if (error) throw error
}

export async function confirmCashPayment(supabase: SupabaseClient, orderId: string): Promise<void> {
  const { error } = await supabase.from("orders").update({ status: "paid", payment_status: "paid" }).eq("id", orderId)
  if (error) throw error
}

export async function cancelPendingOrder(supabase: SupabaseClient, orderId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("cancel_pending_order", { p_order_id: orderId })
  if (error) throw error
  return data as boolean
}
