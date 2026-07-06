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

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 })
  }

  try {
    const payload = await req.json()
    const authHeader = req.headers.get("Authorization")

    // The service-role client's own calls bypass RLS — place_order itself
    // re-derives auth.uid() internally via the forwarded Authorization
    // header on this same request, so a guest's null identity is handled
    // correctly by the RPC, not by any check in this function.
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: authHeader ? { Authorization: authHeader } : {} } }
    )

    const { data, error } = await serviceClient.rpc("place_order", { p_payload: payload })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 })
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch {
    return new Response(JSON.stringify({ error: "Unexpected error placing order" }), { status: 500 })
  }
})
