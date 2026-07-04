export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header className="p-4 border-b">Coffee Shop</header>
      {children}
    </div>
  )
}
