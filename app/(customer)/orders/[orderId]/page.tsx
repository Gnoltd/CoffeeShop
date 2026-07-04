export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  return (
    <main className="p-8">
      <h1>Order Tracking</h1>
      <p>Order ID: {orderId}</p>
    </main>
  )
}
