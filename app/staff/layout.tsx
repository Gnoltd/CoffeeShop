export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="p-4 border-b flex gap-4">
        <span>POS</span>
        <span>Kitchen Display</span>
      </nav>
      {children}
    </div>
  )
}
