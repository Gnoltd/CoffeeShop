import type { SupabaseClient } from "@supabase/supabase-js"

export type TableOccupancyStatus = "available" | "occupied" | "cleaning"

export type TableRecord = {
  id: string
  number: string
  qrToken: string
  locationVi: string
  locationEn: string
  status: TableOccupancyStatus
  cleaningNotifiedAt: string | null
  scanCount: number
}

export type TableInput = {
  number: string
  locationVi: string
  locationEn: string
}

const TABLE_SELECT =
  "id, table_number, qr_code_token, location_vi, location_en, status, cleaning_notified_at, scan_count"

export type TableRow = {
  id: string
  table_number: string
  qr_code_token: string
  location_vi: string
  location_en: string
  status: TableOccupancyStatus
  cleaning_notified_at: string | null
  scan_count: number
}

export function mapTableRow(row: TableRow): TableRecord {
  return {
    id: row.id,
    number: row.table_number,
    qrToken: row.qr_code_token,
    locationVi: row.location_vi,
    locationEn: row.location_en,
    status: row.status,
    cleaningNotifiedAt: row.cleaning_notified_at,
    scanCount: row.scan_count,
  }
}

export async function getTables(supabase: SupabaseClient): Promise<TableRecord[]> {
  const { data, error } = await supabase.from("tables").select(TABLE_SELECT).order("table_number")
  if (error) throw error
  return ((data ?? []) as TableRow[]).map(mapTableRow)
}

export async function createTable(supabase: SupabaseClient, input: TableInput): Promise<TableRecord> {
  const { data, error } = await supabase
    .from("tables")
    .insert({ table_number: input.number, location_vi: input.locationVi, location_en: input.locationEn })
    .select(TABLE_SELECT)
    .single()
  if (error) throw error
  return mapTableRow(data as TableRow)
}

export async function renameTable(supabase: SupabaseClient, id: string, number: string): Promise<TableRecord> {
  const { data, error } = await supabase
    .from("tables")
    .update({ table_number: number })
    .eq("id", id)
    .select(TABLE_SELECT)
    .single()
  if (error) throw error
  return mapTableRow(data as TableRow)
}

export async function updateTableLocation(
  supabase: SupabaseClient,
  id: string,
  locationVi: string,
  locationEn: string
): Promise<TableRecord> {
  const { data, error } = await supabase
    .from("tables")
    .update({ location_vi: locationVi, location_en: locationEn })
    .eq("id", id)
    .select(TABLE_SELECT)
    .single()
  if (error) throw error
  return mapTableRow(data as TableRow)
}

export async function setTableStatus(
  supabase: SupabaseClient,
  id: string,
  status: TableOccupancyStatus
): Promise<TableRecord> {
  const { data, error } = await supabase
    .from("tables")
    .update({ status })
    .eq("id", id)
    .select(TABLE_SELECT)
    .single()
  if (error) throw error
  return mapTableRow(data as TableRow)
}

export async function notifyTableCleaning(supabase: SupabaseClient, id: string): Promise<TableRecord> {
  const { data, error } = await supabase.rpc("notify_table_cleaning", { p_table_id: id })
  if (error) throw error
  return mapTableRow(data as TableRow)
}

export async function regenerateQrToken(supabase: SupabaseClient, id: string): Promise<TableRecord> {
  const { data, error } = await supabase.rpc("regenerate_table_qr_token", { p_table_id: id })
  if (error) throw error
  return mapTableRow(data as TableRow)
}

export async function incrementScanCount(supabase: SupabaseClient, id: string): Promise<TableRecord> {
  const { data, error } = await supabase.rpc("increment_table_scan_count", { p_table_id: id })
  if (error) throw error
  return mapTableRow(data as TableRow)
}

export async function getTableByToken(supabase: SupabaseClient, token: string): Promise<TableRecord | null> {
  const { data, error } = await supabase
    .from("tables")
    .select(TABLE_SELECT)
    .eq("qr_code_token", token)
    .maybeSingle()
  if (error) throw error
  return data ? mapTableRow(data as TableRow) : null
}
