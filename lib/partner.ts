import { SupabaseClient } from "@supabase/supabase-js"

export async function getPartnerVenue(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("venues")
    .select("*")
    .eq("partner_id", userId)
    .single()

  if (error || !data) return null
  return data
}

export async function getPartnerVenueSessionIds(
  supabase: SupabaseClient,
  venueId: string
) {
  const { data } = await supabase
    .from("sessions")
    .select("id")
    .eq("venue_id", venueId)

  return (data || []).map((s: { id: string }) => s.id)
}
