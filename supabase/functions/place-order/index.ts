// place-order: validates cart, computes price server-side, applies
// loyalty redemption, creates order (Stripe/VNPay/cash).
//
// For this pass, only "cash" is a real end-to-end path — Stripe/VNPay
// stay disabled in Checkout until their own specs land (see
// docs/superpowers/specs/2026-07-06-orders-realtime-design.md). This
// function is a thin wrapper around the place_order RPC, shaped so a
// future Stripe/VNPay pass can wrap a gateway call around this same
// call without re-architecting anything here.
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
