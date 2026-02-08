import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { verifyAdmin } from "@/lib/admin"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await verifyAdmin(supabase, user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const sessionId = request.nextUrl.searchParams.get("session_id")
  if (!sessionId) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 })
  }

  const { data: groups, error } = await supabase
    .from("groups")
    .select("*, group_members(user_id, profiles(display_name, work_type), coworker_preferences(work_vibe, noise_preference, communication_style, social_goals, introvert_extrovert))")
    .eq("session_id", sessionId)
    .order("group_number", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ groups: groups || [] })
}
