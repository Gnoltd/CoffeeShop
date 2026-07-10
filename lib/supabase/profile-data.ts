import type { SupabaseClient } from "@supabase/supabase-js"

export async function getProfile(supabase: SupabaseClient, userId: string): Promise<{ fullName: string; phone: string }> {
  const { data, error } = await supabase.from("profiles").select("full_name, phone").eq("id", userId).single()
  if (error) throw error
  return { fullName: data.full_name ?? "", phone: data.phone ?? "" }
}

export async function updateProfile(
  supabase: SupabaseClient,
  userId: string,
  updates: Partial<{ fullName: string; phone: string }>
): Promise<void> {
  const payload: Record<string, string> = {}
  if (updates.fullName !== undefined) payload.full_name = updates.fullName
  if (updates.phone !== undefined) payload.phone = updates.phone
  const { error } = await supabase.from("profiles").update(payload).eq("id", userId)
  if (error) throw error
}
