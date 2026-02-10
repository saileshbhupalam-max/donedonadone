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

  // Check booking limit (max 5 active bookings per user)
  const { count: activeCount } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("cancelled_at", null)
    .in("payment_status", ["pending", "payment_pending", "paid", "confirmed"])

  if ((activeCount || 0) >= 5) {
    return NextResponse.json(
      { error: "Maximum 5 active bookings allowed. Cancel an existing booking first." },
      { status: 400 }
    )
  }

  // Check if user has completed onboarding
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_complete")
    .eq("id", user.id)
    .single()

  if (!profile?.onboarding_complete) {
    return NextResponse.json(
      { error: "Please complete onboarding before booking a session" },
      { status: 400 }
    )
  }

  // Check for overlapping session times
  const { data: sessionToBook } = await supabase
    .from("sessions")
    .select("date, start_time, end_time")
    .eq("id", session_id)
    .single()

  if (sessionToBook) {
    const { data: overlapping } = await supabase
      .from("bookings")
      .select("id, sessions!inner(date, start_time, end_time)")
      .eq("user_id", user.id)
      .is("cancelled_at", null)
      .in("payment_status", ["pending", "payment_pending", "paid", "confirmed"])

    const hasOverlap = (overlapping || []).some((b: Record<string, unknown>) => {
      const s = b.sessions as { date: string; start_time: string; end_time: string } | null
      if (!s || s.date !== sessionToBook.date) return false
      return s.start_time < sessionToBook.end_time && s.end_time > sessionToBook.start_time
    })

    if (hasOverlap) {
      return NextResponse.json(
        { error: "You already have a booking at this time" },
        { status: 409 }
      )
    }
  }

  // Check for existing active booking
  const { data: existing } = await supabase
    .from("bookings")
    .select("id")
    .eq("session_id", session_id)
    .eq("user_id", user.id)
    .is("cancelled_at", null)
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
