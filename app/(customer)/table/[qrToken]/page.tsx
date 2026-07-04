export default async function TableOrderPage({
  params,
}: {
  params: Promise<{ qrToken: string }>
}) {
  const { qrToken } = await params
  return (
    <main className="p-8">
      <h1>Dine-in Order</h1>
      <p>Table token: {qrToken}</p>
    </main>
  )
}
