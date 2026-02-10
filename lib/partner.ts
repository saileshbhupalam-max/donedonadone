import { SupabaseClient } from "@supabase/supabase-js"

export async function verifyPartner(supabase: SupabaseClient, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", userId)
    .single()

  return profile?.user_type === "partner"
}

export async function getPartnerVenue(supabase: SupabaseClient, userId: string) {
  // Verify user_type before returning venue
  const isPartner = await verifyPartner(supabase, userId)
  if (!isPartner) return null

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
