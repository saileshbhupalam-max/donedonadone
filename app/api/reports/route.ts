import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { isValidUUID } from "@/lib/utils"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { reported_user_id, session_id, reason, details } = body

  if (!reported_user_id || !reason) {
    return NextResponse.json({ error: "reported_user_id and reason are required" }, { status: 400 })
  }

  if (!isValidUUID(reported_user_id)) {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 })
  }

  if (reported_user_id === user.id) {
    return NextResponse.json({ error: "Cannot report yourself" }, { status: 400 })
  }

  const validReasons = ["harassment", "inappropriate", "no_show", "disruptive", "spam", "other"]
  if (!validReasons.includes(reason)) {
    return NextResponse.json({ error: "Invalid reason" }, { status: 400 })
  }

  const { error } = await supabase.from("user_reports").insert({
    reporter_id: user.id,
    reported_user_id,
    session_id: session_id || null,
    reason,
    details: details?.slice(0, 500) || null,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
