import type { SupabaseClient } from "@supabase/supabase-js"

export type ShiftMethodBreakdown = { method: "cash" | "stripe" | "vnpay"; count: number; total: number }
export type ShiftTransaction = { id: string; paidAt: number; paymentMethod: string; total: number }
export type ShiftWorker = { staffId: string; fullName: string | null; joinedAt: number; leftAt: number | null }
export type ShiftItemSold = { menuItemId: string; nameVi: string; nameEn: string; quantity: number; revenue: number }

export type ShiftReport = {
  id: string
  openedAt: number
  closedAt: number | null
  openedByName: string | null
  closedByName: string | null
  plannedStartAt: number | null
  plannedEndAt: number | null
  startingCash: number
  countedCash: number | null
  notes: string | null
  byMethod: ShiftMethodBreakdown[]
  expectedCash: number
  difference: number | null
  transactions: ShiftTransaction[]
  workers: ShiftWorker[]
  itemsSold: ShiftItemSold[]
}

export type ShiftHistoryEntry = {
  id: string
  openedAt: number
  closedAt: number
  openedByName: string | null
  closedByName: string | null
  startingCash: number
  countedCash: number
  difference: number
  totalRevenue: number
}

export async function getShiftReport(supabase: SupabaseClient, shiftId?: string): Promise<ShiftReport | null> {
  const { data, error } = await supabase.rpc("get_shift_report", { p_shift_id: shiftId ?? null })
  if (error) throw error
  return data as ShiftReport | null
}

export async function getShiftHistory(supabase: SupabaseClient): Promise<ShiftHistoryEntry[]> {
  const { data, error } = await supabase.rpc("get_shift_history")
  if (error) throw error
  return (data ?? []) as ShiftHistoryEntry[]
}

export async function openShift(
  supabase: SupabaseClient,
  startingCash: number,
  plannedStartAt?: number | null,
  plannedEndAt?: number | null
): Promise<ShiftReport> {
  const { data, error } = await supabase.rpc("open_shift", {
    p_starting_cash: startingCash,
    p_planned_start_at: plannedStartAt ? new Date(plannedStartAt).toISOString() : null,
    p_planned_end_at: plannedEndAt ? new Date(plannedEndAt).toISOString() : null,
  })
  if (error) throw error
  return data as ShiftReport
}

export async function closeShift(supabase: SupabaseClient, countedCash: number, notes?: string): Promise<ShiftReport> {
  const { data, error } = await supabase.rpc("close_shift", { p_counted_cash: countedCash, p_notes: notes ?? null })
  if (error) throw error
  return data as ShiftReport
}

export async function joinShift(supabase: SupabaseClient): Promise<ShiftReport> {
  const { data, error } = await supabase.rpc("join_shift")
  if (error) throw error
  return data as ShiftReport
}

export async function leaveShift(supabase: SupabaseClient): Promise<ShiftReport> {
  const { data, error } = await supabase.rpc("leave_shift")
  if (error) throw error
  return data as ShiftReport
}

export async function isShiftOpen(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_shift_open")
  if (error) throw error
  return Boolean(data)
}
