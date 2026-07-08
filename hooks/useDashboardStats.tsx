"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { getDashboardStats, type DashboardStats } from "@/lib/supabase/dashboard-data"

export type { DashboardStats }

const EMPTY_STATS: DashboardStats = {
  todayRevenue: 0,
  ordersToday: 0,
  loyaltyIssuedToday: 0,
  sevenDayRevenue: [],
  bestSellers: [],
}

export function useDashboardStats(): { stats: DashboardStats; isLoading: boolean } {
  const [supabase] = useState(() => createClient())
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    function refetch() {
      getDashboardStats(supabase)
        .then((result) => {
          if (!cancelled) setStats(result)
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false)
        })
    }

    refetch()

    const channel = supabase
      .channel("dashboard-stats-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        if (!cancelled) refetch()
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => {
        if (!cancelled) refetch()
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "loyalty_transactions" }, () => {
        if (!cancelled) refetch()
      })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED" && status !== "CLOSED") {
          console.warn(`Dashboard stats realtime subscription status: ${status}`)
        }
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
    // Runs once on mount; `supabase` is a stable client held in state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { stats, isLoading }
}
