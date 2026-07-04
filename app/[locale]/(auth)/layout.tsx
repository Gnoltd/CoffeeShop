import { CustomerHeader } from "@/components/customer/header"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CustomerHeader />
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center py-8">{children}</div>
    </>
  )
}
