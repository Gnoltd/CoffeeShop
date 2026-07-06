import type { SupabaseClient } from "@supabase/supabase-js"

export async function getCurrentRole(supabase: SupabaseClient): Promise<string | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return null

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .single()

    if (!profile) return null
    return profile.is_active ? profile.role : "customer"
  } catch {
    return null
  }
}
