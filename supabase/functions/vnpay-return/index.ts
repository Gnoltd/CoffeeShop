// vnpay-return: browser-facing redirect after a VNPay checkout attempt.
// NOT the source of truth for "paid" — vnpay-ipn is (see that function
// and docs/superpowers/specs/2026-07-07-vnpay-payment-integration-design.md).
// This only decides where to send the customer's browser next, and
// self-cancels an order the customer backed out of or that failed,
// via the same guest-safe cancel_pending_order RPC the Stripe work
// added (migration 0018) — reused as-is, no VNPay-specific
// cancellation logic needed.

import { createClient } from "jsr:@supabase/supabase-js@2"
import { verifyVnpaySignature } from "../_shared/vnpay.ts"

// vnpay-return's URL carries orderId/locale query params (added by
// place-order's returnUrl construction) that aren't part of VNPay's own
// signed param set — unlike vnpay-ipn, which is called directly by
// VNPay's servers with only vnp_* params.
const RETURN_URL_EXTRA_PARAMS = ["orderId", "locale"]

Deno.serve(async (req) => {
  const params = new URL(req.url).searchParams
  const locale = params.get("locale") === "en" ? "en" : "vi"
  const siteUrl = Deno.env.get("SITE_URL")!
  const hashSecret = Deno.env.get("VNPAY_HASH_SECRET")

  // Use vnp_TxnRef (signed, tamper-evident) as the order id, not the
  // separate `orderId` query param -- that one is excluded from the
  // signature (see RETURN_URL_EXTRA_PARAMS above) purely because it's
  // our own return-URL bookkeeping, which means it's NOT tamper-evident:
  // an attacker could keep a genuinely-signed VNPay callback for their
  // own trivial order but swap `orderId` to point at a victim's order,
  // and the signature would still verify. vnp_TxnRef is set to the real
  // order id at checkout-URL creation time (buildVnpayCheckoutUrl) and
  // is part of the signed vnp_* field set, so it can't be substituted
  // without invalidating vnp_SecureHash. vnpay-ipn already used this
  // field correctly; this brings vnpay-return in line with it.
  const orderId = params.get("vnp_TxnRef")

  if (!orderId || !hashSecret || !(await verifyVnpaySignature(params, hashSecret, RETURN_URL_EXTRA_PARAMS))) {
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
