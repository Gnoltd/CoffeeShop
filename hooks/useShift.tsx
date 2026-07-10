"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { getShiftReport, type ShiftReport } from "@/lib/supabase/shift-data"

export function useShift() {
  const [supabase] = useState(() => createClient())
  const [report, setReport] = useState<ShiftReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    function refetch() {
      getShiftReport(supabase)
        .then((result) => {
          if (!cancelled) setReport(result)
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false)
        })
    }

    refetch()

    const channel = supabase
      .channel("shift-report-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        if (!cancelled) refetch()
      })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED" && status !== "CLOSED") {
          console.warn(`Shift report realtime subscription status: ${status}`)
        }
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  return { supabase, report, isLoading, refetch: () => setRefreshKey((k) => k + 1) }
}
