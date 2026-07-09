"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { getOrderHistory, type OrderHistoryFilters, type OrderHistoryRow } from "@/lib/supabase/orders-data"

/** No default window -- an unset bound means "all time," matching customers' own order history. */
export function buildDateRange(dateFrom?: string, dateTo?: string): { dateFrom?: string; dateTo?: string } {
  if (!dateFrom || !dateTo) return { dateFrom, dateTo }
  const from = new Date(dateFrom)
  const to = new Date(dateTo)
  return from <= to ? { dateFrom, dateTo } : { dateFrom: dateTo, dateTo: dateFrom }
}

export function useOrderHistory(filters: OrderHistoryFilters, page: number, pageSize: number) {
  const [supabase] = useState(() => createClient())
  const [rows, setRows] = useState<OrderHistoryRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const { dateFrom, dateTo } = buildDateRange(filters.dateFrom, filters.dateTo)
  const resolvedFilters: OrderHistoryFilters = { ...filters, dateFrom, dateTo }
  const filtersKey = JSON.stringify(resolvedFilters)

  useEffect(() => {
    let cancelled = false

    function refetch() {
      setIsLoading(true)
      getOrderHistory(supabase, resolvedFilters, { limit: pageSize, offset: (page - 1) * pageSize })
        .then(({ rows, totalCount }) => {
          if (!cancelled) {
            setRows(rows)
            setTotalCount(totalCount)
          }
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false)
        })
    }

    refetch()

    const channel = supabase
      .channel("order-history-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        if (!cancelled) refetch()
      })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED" && status !== "CLOSED") {
          console.warn(`Order history realtime subscription status: ${status}`)
        }
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, page, pageSize])

  return { rows, totalCount, isLoading }
}
