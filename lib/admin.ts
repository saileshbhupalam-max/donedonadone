import { SupabaseClient } from "@supabase/supabase-js"

export async function verifyAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", userId)
    .single()

  return data?.user_type === "admin"
}
