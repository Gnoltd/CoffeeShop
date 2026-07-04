export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="p-4 border-b flex gap-4">
        <span>Dashboard</span>
        <span>Menu</span>
        <span>Inventory</span>
        <span>Tables</span>
        <span>Staff</span>
        <span>Settings</span>
      </nav>
      {children}
    </div>
  )
}
