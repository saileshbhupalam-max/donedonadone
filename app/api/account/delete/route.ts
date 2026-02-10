import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Cancel all active bookings
  await supabase
    .from("bookings")
    .update({ cancelled_at: new Date().toISOString(), payment_status: "cancelled" })
    .eq("user_id", user.id)
    .is("cancelled_at", null)

  // Anonymize profile data
  await supabase
    .from("profiles")
    .update({
      full_name: "Deleted User",
      display_name: "deleted",
      phone: null,
      bio: null,
      avatar_url: null,
      city: null,
      industry: null,
    })
    .eq("id", user.id)

  // Delete preferences
  await supabase
    .from("coworker_preferences")
    .delete()
    .eq("user_id", user.id)

  // Sign out
  await supabase.auth.signOut()

  return NextResponse.json({ success: true })
}
