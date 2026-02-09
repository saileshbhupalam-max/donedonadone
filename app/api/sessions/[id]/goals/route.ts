import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: sessionId } = await params

  const { data: goals } = await supabase
    .from("session_goals")
    .select("id, user_id, goal_text, completed, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })

  return NextResponse.json({ goals: goals || [] })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: sessionId } = await params
  const body = await request.json()
  const { goal_text } = body

  if (!goal_text || goal_text.length > 200) {
    return NextResponse.json({ error: "Goal text required (max 200 chars)" }, { status: 400 })
  }

  // Verify booking exists
  const { data: booking } = await supabase
    .from("bookings")
    .select("id")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .in("payment_status", ["paid", "confirmed"])
    .single()

  if (!booking) {
    return NextResponse.json({ error: "No confirmed booking found" }, { status: 403 })
  }

  // Check limit (max 3 goals)
  const { count } = await supabase
    .from("session_goals")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("user_id", user.id)

  if ((count || 0) >= 3) {
    return NextResponse.json({ error: "Maximum 3 goals per session" }, { status: 400 })
  }

  const { data: goal, error } = await supabase
    .from("session_goals")
    .insert({
      booking_id: booking.id,
      user_id: user.id,
      session_id: sessionId,
      goal_text,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ goal })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { goal_id, completed } = body

  const { error } = await supabase
    .from("session_goals")
    .update({ completed })
    .eq("id", goal_id)
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { goal_id } = body

  const { error } = await supabase
    .from("session_goals")
    .delete()
    .eq("id", goal_id)
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
