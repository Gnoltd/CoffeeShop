// vnpay-return: browser-facing redirect after a VNPay checkout attempt.
// NOT the source of truth for "paid" — vnpay-ipn is (see that function
// and docs/superpowers/specs/2026-07-07-vnpay-payment-integration-design.md).
// This only decides where to send the customer's browser next, and
// self-cancels an order the customer backed out of or that failed,
// via the same guest-safe cancel_pending_order RPC the Stripe work
// added (migration 0018) — reused as-is, no VNPay-specific
// cancellation logic needed.

import { createClient } from "jsr:@supabase/supabase-js@2"

// VNPay signs with PHP urlencode()-style encoding — spaces become "+",
// not "%20" like encodeURIComponent's default. See place-order's
// buildVnpayCheckoutUrl for the matching outgoing-side fix and the
// live-testing story behind it.
function vnpayEncode(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, "+")
}

async function verifyVnpaySignature(params: URLSearchParams, secret: string): Promise<boolean> {
  const received = params.get("vnp_SecureHash")
  if (!received) return false
  const entries = Array.from(params.entries()).filter(
    ([k]) => k !== "vnp_SecureHash" && k !== "vnp_SecureHashType" && k !== "orderId" && k !== "locale"
  )
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  const signString = entries.map(([k, v]) => `${k}=${vnpayEncode(v)}`).join("&")
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

Deno.serve(async (req) => {
  const params = new URL(req.url).searchParams
  const orderId = params.get("orderId")
  const locale = params.get("locale") === "en" ? "en" : "vi"
  const siteUrl = Deno.env.get("SITE_URL")!
  const hashSecret = Deno.env.get("VNPAY_HASH_SECRET")

  if (!orderId || !hashSecret || !(await verifyVnpaySignature(params, hashSecret))) {
    return Response.redirect(`${siteUrl}/${locale}/checkout?paymentFailed=1`, 302)
  }

  const responseCode = params.get("vnp_ResponseCode")

  if (responseCode === "00") {
    return Response.redirect(`${siteUrl}/${locale}/orders/${orderId}`, 302)
  }

  const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
  const { data: wasCancelled } = await serviceClient.rpc("cancel_pending_order", { p_order_id: orderId })

  // cancel_pending_order only ever cancels a still-pre-kitchen order and
  // returns false as a no-op otherwise (e.g. a served Pay Later order
  // whose deferred payment attempt just failed) -- send that case back
  // to its own tracking page instead of an empty Checkout.
  if (wasCancelled) {
    return Response.redirect(`${siteUrl}/${locale}/checkout?paymentFailed=1`, 302)
  }
  return Response.redirect(`${siteUrl}/${locale}/orders/${orderId}?paymentFailed=1`, 302)
})
