// Shared paid-transition guard, used by both stripe-webhook and
// vnpay-ipn — the two source-of-truth "payment cleared" webhooks.

// A pre-kitchen Pay Now order also needs `status` flipped to 'paid'
// (that's what makes it kitchen-visible). A Pay Later order is already
// 'served' by the time its deferred payment clears — only
// payment_status changes there; complete_order_when_served_and_paid
// (migration 0022) takes it to 'completed' from that single field flip.
export function buildPaidUpdate(currentStatus: string | undefined): { status?: string; payment_status: "paid" } {
  return currentStatus === "served" ? { payment_status: "paid" } : { status: "paid", payment_status: "paid" }
}
