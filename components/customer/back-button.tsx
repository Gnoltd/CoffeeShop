"use client"

import { ArrowLeft } from "lucide-react"
import { useRouter } from "@/i18n/navigation"

export function BackButton({ label }: { label: string }) {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label={label}
      title={label}
      className="-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-primary transition-colors hover:bg-muted"
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  )
}
