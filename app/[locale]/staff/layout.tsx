import { StaffNav } from "@/components/staff/staff-nav"

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <StaffNav />
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  )
}
