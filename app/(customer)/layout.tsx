export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="p-4 border-b flex gap-4">
        <span>Menu</span>
        <span>Cart</span>
        <span>Orders</span>
        <span>Profile</span>
        <span>Loyalty</span>
      </nav>
      {children}
    </div>
  )
}
