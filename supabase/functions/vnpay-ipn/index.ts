// vnpay-ipn: VNPay's server-to-server confirmation call — the sole
// source of truth for "paid," mirroring stripe-webhook's role. See
// docs/superpowers/specs/2026-07-07-vnpay-payment-integration-design.md.
//
// Unlike vnpay-return (a browser redirect that isn't guaranteed to
// fire — the customer can close the tab first), VNPay always calls
// this from its own servers regardless of what the customer's browser
// does. verify_jwt is disabled — VNPay's own signature is the real
// trust boundary; there is no Supabase session on this request at all.
//
// Every guarded UPDATE below uses payment_status = 'pending', and
// handle_order_paid (migration 0007) has its own `old is distinct from
// 'paid'` check — together these make VNPay's IPN retries a safe no-op
// (returning RspCode "02") rather than a double inventory deduction or
// double loyalty award.

import { createClient } from "jsr:@supabase/supabase-js@2"

async function verifyVnpaySignature(params: URLSearchParams, secret: string): Promise<boolean> {
  const received = params.get("vnp_SecureHash")
  if (!received) return false
  const entries = Array.from(params.entries()).filter(
    ([k]) => k !== "vnp_SecureHash" && k !== "vnp_SecureHashType"
  )
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  const signString = entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  )
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signString))
  const computed = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  if (computed.length !== received.length) return false
  let mismatch = 0
  for (let i = 0; i < computed.length; i++) {
    mismatch |= computed.charCodeAt(i) ^ received.charCodeAt(i)
  }
  return mismatch === 0
}

function ipnResponse(rspCode: string, message: string): Response {
  return new Response(JSON.stringify({ RspCode: rspCode, Message: message }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

Deno.serve(async (req) => {
  const params = new URL(req.url).searchParams

  const hashSecret = Deno.env.get("VNPAY_HASH_SECRET")
  if (!hashSecret || !(await verifyVnpaySignature(params, hashSecret))) {
    return ipnResponse("97", "Invalid signature")
  }

  const orderId = params.get("vnp_TxnRef")
  const vnpAmount = Number(params.get("vnp_Amount") ?? "0")
  const responseCode = params.get("vnp_ResponseCode")

  if (!orderId) {
    return ipnResponse("01", "Order not found")
  }

  const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

  const { data: order } = await serviceClient
    .from("orders")
    .select("id, total, payment_status")
    .eq("id", orderId)
    .maybeSingle()

  if (!order) {
    return ipnResponse("01", "Order not found")
  }

  if (vnpAmount / 100 !== order.total) {
    return ipnResponse("04", "Invalid amount")
  }

  if (order.payment_status === "paid") {
    return ipnResponse("02", "Order already confirmed")
  }

  if (responseCode === "00") {
    await serviceClient
      .from("orders")
      .update({ status: "paid", payment_status: "paid" })
      .eq("id", orderId)
      .eq("payment_status", "pending")
  } else {
    await serviceClient
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", orderId)
      .eq("payment_status", "pending")
  }

  return ipnResponse("00", "Confirm Success")
})
