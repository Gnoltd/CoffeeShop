// place-order: validates cart, computes price server-side, applies
// loyalty redemption, creates order (Stripe/VNPay/cash).
//
// Stripe follow-up (2026-07-07): when paymentMethod is "stripe" and the
// payment wasn't already collected in person (POS sends
// paymentCollected: true and skips this branch entirely — see
// docs/superpowers/specs/2026-07-07-stripe-payment-integration-design.md),
// this function also creates a real Stripe Checkout Session for the
// order's server-computed total and returns its hosted URL for the
// browser to redirect to. Uses raw fetch against Stripe's REST API
// (form-urlencoded, per Stripe's API convention) rather than an SDK, to
// match this project's existing no-extra-Deno-dependency edge functions.
// VND is a Stripe zero-decimal currency — the integer total is sent
// as-is, never multiplied by 100.
//
// VNPay follow-up (2026-07-07): same shape, different gateway — see
// docs/superpowers/specs/2026-07-07-vnpay-payment-integration-design.md.
// Unlike Stripe, no API call is needed to build the redirect URL — it's
// a locally-signed query string. VNPay's amount convention is the
// OPPOSITE of Stripe's: always total × 100, not a zero-decimal
// exception. vnp_ReturnUrl points at this project's own Supabase
// function URL (SUPABASE_URL), not SITE_URL (the Vercel app domain used
// for Stripe's success/cancel URLs) — vnpay-return does its own
// server-side redirect onward to the actual Next.js pages after
// verifying VNPay's hash.
//
// verify_jwt is disabled for this function: a guest (no session at
// all) must be able to place an order, and place_order itself already
// correctly derives a null customer_id for that case — Supabase's
// platform-level JWT verification would otherwise reject a guest's
// request before this code ever runs.

import { createClient } from "jsr:@supabase/supabase-js@2"

// The browser calls this cross-origin (app on vercel.app, function on
// supabase.co) via supabase.functions.invoke, which sends a CORS
// preflight OPTIONS request first — found live via Playwright when a
// real browser call failed with a CORS error despite curl working fine
// (curl never sends a preflight, so this was invisible to direct testing).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// supabase.functions.invoke() always attaches *some* Authorization
// header, even for a guest with no session — in that case it's the
// client's own publishable key (e.g. "sb_publishable_..."), not a JWT.
// Forwarding that opaque value on to a Postgres connection makes
// auth.uid() fail ("Expected 3 parts in JWT; got 1") instead of just
// resolving to null like a guest should — found live via Playwright.
// Only forward it when it's actually JWT-shaped (a real logged-in
// customer's access token); otherwise let the service-role client run
// with no forwarded identity, which is exactly what a guest needs.
function isJwtShaped(token: string): boolean {
  return token.split(".").length === 3
}

const VALID_LOCALES = ["vi", "en"]

// Flattens a nested object into Stripe's bracket-notation form fields,
// e.g. { line_items: [{ quantity: 1 }] } -> "line_items[0][quantity]=1".
// Stripe's REST API expects application/x-www-form-urlencoded bodies,
// not JSON.
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
      // Stripe's minimum allowed Checkout Session lifetime (30 minutes) —
      // chosen over the 24h default so an abandoned session doesn't leave
      // a pending_payment order sitting around for a full day.
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      metadata: { order_id: params.orderId },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "vnd",
            // VND is zero-decimal in Stripe — pass the integer total as-is.
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

// yyyyMMddHHmmss in Asia/Ho_Chi_Minh time — VNPay requires this exact
// format and timezone regardless of where this function actually runs.
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

// VNPay signs with PHP urlencode()-style encoding — spaces become "+",
// not "%20" like encodeURIComponent's default. Confirmed by comparing
// against a known-working reference implementation after live sandbox
// testing showed "Invalid signature" on VNPay's own payment page (i.e.
// before ever reaching our code again) — vnp_OrderInfo contains spaces,
// so plain encodeURIComponent silently produced a wrong hash.
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
    // VNPay's own convention: amount is always x100, regardless of
    // currency having no subdivision — the OPPOSITE of the zero-decimal
    // VND handling used for Stripe above. Do not "fix" this to match.
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
    const authHeader = req.headers.get("Authorization")
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null
    const forwardedAuthHeader = bearerToken && isJwtShaped(bearerToken) ? authHeader : null

    // The service-role client's own calls bypass RLS — place_order itself
    // re-derives auth.uid() internally via the forwarded Authorization
    // header on this same request (when there is a real one), so a
    // guest's null identity is handled correctly by the RPC, not by any
    // check in this function.
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: forwardedAuthHeader ? { Authorization: forwardedAuthHeader } : {} } }
    )

    const { data, error } = await serviceClient.rpc("place_order", { p_payload: payload })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders })
    }

    const locale = VALID_LOCALES.includes(payload.locale) ? payload.locale : "vi"
    const needsStripeSession = payload.paymentMethod === "stripe" && payload.paymentCollected !== true && payload.payAt !== "later"
    const needsVnpayUrl = payload.paymentMethod === "vnpay" && payload.paymentCollected !== true && payload.payAt !== "later"

    if (needsStripeSession) {
      const siteUrl = Deno.env.get("SITE_URL")!
      const tableQuery =
        payload.orderType === "dine_in" && payload.tableNumber
          ? `?table=${encodeURIComponent(payload.tableNumber)}`
          : ""

      const session = await createStripeCheckoutSession({
        orderId: data.orderId,
        total: data.total,
        successUrl: `${siteUrl}/${locale}/orders/${data.orderId}${tableQuery}`,
        cancelUrl: `${siteUrl}/${locale}/checkout?stripeCanceled=${data.orderId}`,
      })

      if ("error" in session) {
        return new Response(JSON.stringify({ error: session.error }), { status: 400, headers: corsHeaders })
      }

      return new Response(JSON.stringify({ ...data, checkoutUrl: session.url }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (needsVnpayUrl) {
      const ipAddr = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1"
      const returnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/vnpay-return?orderId=${data.orderId}&locale=${locale}`

      const checkoutUrl = await buildVnpayCheckoutUrl({
        orderId: data.orderId,
        total: data.total,
        ipAddr,
        locale,
        returnUrl,
      })

      return new Response(JSON.stringify({ ...data, checkoutUrl }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch {
    return new Response(JSON.stringify({ error: "Unexpected error placing order" }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})
