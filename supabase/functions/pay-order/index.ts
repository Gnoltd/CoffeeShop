// pay-order: lets a customer choose (and pay, for Stripe/VNPay) the
// payment method for an already-placed, already-served Pay Later order
// — the method itself, not just the timing, is deferred to this point
// (revised same-day; see the "Revision" section of
// docs/superpowers/specs/2026-07-08-deferred-payment-service-lifecycle-design.md).
// Always records payment_method on the order first. For "cash" that's
// the whole job — staff confirm receipt later via the existing flow.
// For "stripe"/"vnpay" it then reuses the same Stripe Checkout Session /
// VNPay redirect construction as place-order, just invoked later
// against an existing order instead of at placement time. verify_jwt is
// disabled — a guest's own deferred order must be payable without a
// session, same reasoning as place-order.

import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const VALID_LOCALES = ["vi", "en"]

function flattenForStripe(value: unknown, prefix: string, out: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, i) => flattenForStripe(item, `${prefix}[${i}]`, out))
  } else if (value !== null && typeof value === "object") {
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      flattenForStripe(v, prefix ? `${prefix}[${key}]` : key, out)
    }
  } else if (value !== undefined && value !== null) {
    out.push(`${encodeURIComponent(prefix)}=${encodeURIComponent(String(value))}`)
  }
}

async function createStripeCheckoutSession(params: {
  orderId: string
  total: number
  successUrl: string
  cancelUrl: string
}): Promise<{ url: string } | { error: string }> {
  const body: string[] = []
  flattenForStripe(
    {
      mode: "payment",
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      metadata: { order_id: params.orderId },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "vnd",
            unit_amount: params.total,
            product_data: { name: "PhaDinCoffee Order" },
          },
        },
      ],
    },
    "",
    body
  )

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")!}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.join("&"),
  })

  const json = await response.json()
  if (!response.ok) {
    return { error: json?.error?.message ?? "Stripe rejected the checkout session" }
  }
  return { url: json.url as string }
}

const VNPAY_GATEWAY_URL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"

function toVnpayDateString(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)!.value
  return `${get("year")}${get("month")}${get("day")}${get("hour")}${get("minute")}${get("second")}`
}

function vnpayEncode(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, "+")
}

async function signVnpayParams(params: Record<string, string>, secret: string): Promise<string> {
  const sortedKeys = Object.keys(params).sort()
  const signString = sortedKeys.map((k) => `${k}=${vnpayEncode(params[k])}`).join("&")
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  )
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signString))
  return Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

async function buildVnpayCheckoutUrl(params: {
  orderId: string
  total: number
  ipAddr: string
  locale: string
  returnUrl: string
}): Promise<string> {
  const now = new Date()
  const expire = new Date(now.getTime() + 15 * 60 * 1000)
  const vnpParams: Record<string, string> = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: Deno.env.get("VNPAY_TMN_CODE")!,
    vnp_Amount: String(params.total * 100),
    vnp_CurrCode: "VND",
    vnp_TxnRef: params.orderId,
    vnp_OrderInfo: `Thanh toan don hang ${params.orderId}`,
    vnp_OrderType: "other",
    vnp_Locale: params.locale === "vi" ? "vn" : "en",
    vnp_ReturnUrl: params.returnUrl,
    vnp_IpAddr: params.ipAddr,
    vnp_CreateDate: toVnpayDateString(now),
    vnp_ExpireDate: toVnpayDateString(expire),
  }
  const secureHash = await signVnpayParams(vnpParams, Deno.env.get("VNPAY_HASH_SECRET")!)
  const query = Object.keys(vnpParams)
    .sort()
    .map((k) => `${k}=${vnpayEncode(vnpParams[k])}`)
    .join("&")
  return `${VNPAY_GATEWAY_URL}?${query}&vnp_SecureHash=${secureHash}`
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    const orderId = payload.orderId as string | undefined
    const paymentMethod = payload.paymentMethod as string | undefined
    const locale = VALID_LOCALES.includes(payload.locale) ? payload.locale : "vi"
    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId is required" }), { status: 400, headers: corsHeaders })
    }
    if (paymentMethod !== "cash" && paymentMethod !== "stripe" && paymentMethod !== "vnpay") {
      return new Response(JSON.stringify({ error: "paymentMethod must be cash, stripe, or vnpay" }), { status: 400, headers: corsHeaders })
    }

    const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

    const { data: order, error: fetchError } = await serviceClient
      .from("orders")
      .select("id, total, payment_status, status")
      .eq("id", orderId)
      .maybeSingle()

    if (fetchError || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), { status: 404, headers: corsHeaders })
    }
    if (order.payment_status !== "pending") {
      return new Response(JSON.stringify({ error: "This order is already paid" }), { status: 400, headers: corsHeaders })
    }
    if (order.status !== "served") {
      return new Response(JSON.stringify({ error: "This order isn't ready for payment yet" }), { status: 400, headers: corsHeaders })
    }

    const { error: updateError } = await serviceClient.from("orders").update({ payment_method: paymentMethod }).eq("id", orderId)
    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to record payment method" }), { status: 500, headers: corsHeaders })
    }

    if (paymentMethod === "cash") {
      // Nothing more to do here -- staff collect it in person and confirm
      // receipt via the existing "Confirm Cash Received" flow (KDS Tables
      // column / pending-cash banner), which now picks this order up since
      // payment_method is set.
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const siteUrl = Deno.env.get("SITE_URL")!

    if (paymentMethod === "stripe") {
      const session = await createStripeCheckoutSession({
        orderId: order.id,
        total: order.total,
        successUrl: `${siteUrl}/${locale}/orders/${order.id}`,
        cancelUrl: `${siteUrl}/${locale}/orders/${order.id}?stripeCanceled=1`,
      })
      if ("error" in session) {
        return new Response(JSON.stringify({ error: session.error }), { status: 400, headers: corsHeaders })
      }
      return new Response(JSON.stringify({ checkoutUrl: session.url }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const ipAddr = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1"
    const returnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/vnpay-return?orderId=${order.id}&locale=${locale}`
    const checkoutUrl = await buildVnpayCheckoutUrl({
      orderId: order.id,
      total: order.total,
      ipAddr,
      locale,
      returnUrl,
    })
    return new Response(JSON.stringify({ checkoutUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch {
    return new Response(JSON.stringify({ error: "Unexpected error creating payment" }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})
