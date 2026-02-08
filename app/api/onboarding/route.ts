import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()

  // Update profile
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      display_name: body.display_name,
      phone: body.phone,
      work_type: body.work_type,
      industry: body.industry,
      bio: body.bio,
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)

  if (profileError) {
    return NextResponse.json(
      { error: profileError.message },
      { status: 500 }
    )
  }

  // Upsert coworker preferences
  const { error: prefsError } = await supabase
    .from("coworker_preferences")
    .upsert(
      {
        user_id: user.id,
        preferred_vibe: body.preferred_vibe,
        noise_preference: body.noise_preference,
        break_frequency: body.break_frequency,
        communication_style: body.communication_style,
        productive_times: body.productive_times || [],
        social_goals: body.social_goals || [],
        introvert_extrovert: body.introvert_extrovert || 3,
        interests: body.interests || [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )

  if (prefsError) {
    return NextResponse.json(
      { error: prefsError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
