import type { SupabaseClient } from "@supabase/supabase-js"

export type StaffRole = "staff" | "manager" | "admin"

export type StaffMember = {
  id: string
  fullName: string
  phone: string | null
  role: StaffRole
  isActive: boolean
  email: string
}

export type CreateStaffInput = {
  fullName: string
  email: string
  role: StaffRole
}

export type UpdateStaffInput = {
  fullName: string
  role: StaffRole
  isActive: boolean
}

type StaffMemberRow = {
  id: string
  full_name: string | null
  phone: string | null
  role: StaffRole
  is_active: boolean
  email: string
}

function mapStaffMemberRow(row: StaffMemberRow): StaffMember {
  return {
    id: row.id,
    fullName: row.full_name ?? "",
    phone: row.phone,
    role: row.role,
    isActive: row.is_active,
    email: row.email,
  }
}

export async function getStaffMembers(supabase: SupabaseClient): Promise<StaffMember[]> {
  const { data, error } = await supabase.rpc("get_staff_members")
  if (error) throw error
  return ((data ?? []) as StaffMemberRow[]).map(mapStaffMemberRow)
}

export async function updateStaffMember(
  supabase: SupabaseClient,
  id: string,
  input: UpdateStaffInput
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: input.fullName, role: input.role, is_active: input.isActive })
    .eq("id", id)
  if (error) throw error
}

export async function createStaffAccount(
  supabase: SupabaseClient,
  input: CreateStaffInput
): Promise<{ userId: string; temporaryPassword: string }> {
  const { data, error } = await supabase.functions.invoke("create-staff-account", {
    body: { fullName: input.fullName, email: input.email, role: input.role },
  })
  if (error || data?.error) throw error ?? new Error(data.error)
  return data as { userId: string; temporaryPassword: string }
}
