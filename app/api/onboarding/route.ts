import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { moderateText, sanitizeDisplayName } from "@/lib/moderation"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()

  // Moderate bio and display name
  if (body.bio) {
    const bioCheck = moderateText(body.bio)
    if (!bioCheck.clean) {
      return NextResponse.json({ error: bioCheck.reason }, { status: 400 })
    }
  }

  const displayName = sanitizeDisplayName(body.display_name || "")
  if (!displayName) {
    return NextResponse.json({ error: "Display name is required" }, { status: 400 })
  }

  // Update profile
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      phone: body.phone,
      work_type: body.work_type,
      industry: body.industry,
      bio: body.bio?.slice(0, 200),
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
