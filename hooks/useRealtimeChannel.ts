import { useEffect } from "react"
import type { RealtimePostgresChangesPayload, REALTIME_SUBSCRIBE_STATES, SupabaseClient } from "@supabase/supabase-js"

type ChangeEvent = "*" | "INSERT" | "UPDATE" | "DELETE"

// Each subscription's row shape is only known to its own onChange body
// (which already casts payload.new/payload.old to its real row type, same
// as before this hook existed) — kept untyped-by-row here so a single
// array can mix subscriptions across different tables.
export type RealtimeSubscription = {
  table: string
  event: ChangeEvent
  onChange: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
}

/**
 * Owns the channel create/subscribe/cleanup lifecycle shared by every
 * Realtime-backed hook in this app. Deliberately doesn't own the initial
 * data fetch — that shape (single query, Promise.all, paginated) varies
 * too much per caller to force into one signature; callers guard their
 * own initial fetch with their own `cancelled` flag as before.
 */
export function useRealtimeChannel(
  supabase: SupabaseClient,
  channelName: string,
  subscriptions: RealtimeSubscription[],
  options?: {
    onStatusChange?: (status: REALTIME_SUBSCRIBE_STATES) => void
    deps?: unknown[]
  }
): void {
  const { onStatusChange, deps = [] } = options ?? {}

  useEffect(() => {
    let cancelled = false

    let channel = supabase.channel(channelName)
    for (const sub of subscriptions) {
      channel = channel.on(
        "postgres_changes",
        { event: sub.event, schema: "public", table: sub.table },
        (payload) => {
          if (!cancelled) sub.onChange(payload)
        }
      )
    }
    channel.subscribe((status) => {
      if (cancelled) return
      onStatusChange?.(status)
      if (status !== "SUBSCRIBED" && status !== "CLOSED") {
        console.warn(`${channelName} realtime subscription status: ${status}`)
      }
    })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
