import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("*, sessions(*, venues(*))")
    .eq("user_id", user.id)
    .order("booked_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ bookings })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { session_id } = body

  if (!session_id) {
    return NextResponse.json(
      { error: "session_id is required" },
      { status: 400 }
    )
  }

  // Check for existing active booking
  const { data: existing } = await supabase
    .from("bookings")
    .select("id")
    .eq("session_id", session_id)
    .eq("user_id", user.id)
    .neq("status", "cancelled")
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: "You already have a booking for this session" },
      { status: 409 }
    )
  }

  // Call atomic book_session function
  const { data: bookingId, error } = await supabase.rpc("book_session", {
    p_session_id: session_id,
    p_user_id: user.id,
  })

  if (error) {
    const message = error.message.includes("full")
      ? "This session is full. Try joining the waitlist."
      : error.message
    return NextResponse.json({ error: message }, { status: 400 })
  }

  // Fetch the created booking with session/venue details
  const { data: booking } = await supabase
    .from("bookings")
    .select("*, sessions(*, venues(*))")
    .eq("id", bookingId)
    .single()

  return NextResponse.json({ booking }, { status: 201 })
}
