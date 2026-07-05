import type { SupabaseClient } from "@supabase/supabase-js"

export async function getCurrentRole(supabase: SupabaseClient): Promise<string | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return null

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    return profile?.role ?? null
  } catch {
    return null
  }
}
