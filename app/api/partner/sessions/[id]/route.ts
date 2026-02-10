import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { getPartnerVenue } from "@/lib/partner"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const venue = await getPartnerVenue(supabase, user.id)
  if (!venue) {
    return NextResponse.json({ error: "No venue found" }, { status: 404 })
  }

  const { id } = await params
  const body = await request.json()

  // Verify ownership
  const { data: existing } = await supabase
    .from("sessions")
    .select("id, venue_id")
    .eq("id", id)
    .single()

  if (!existing || existing.venue_id !== venue.id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  // Whitelist allowed update fields — prevent mass assignment
  const ALLOWED_FIELDS = ["date", "start_time", "end_time", "duration_hours", "venue_price", "max_spots", "status"] as const
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) {
      updates[field] = body[field]
    }
  }

  const { data: session, error } = await supabase
    .from("sessions")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ session })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const venue = await getPartnerVenue(supabase, user.id)
  if (!venue) {
    return NextResponse.json({ error: "No venue found" }, { status: 404 })
  }

  const { id } = await params

  // Verify ownership
  const { data: existing } = await supabase
    .from("sessions")
    .select("id, venue_id")
    .eq("id", id)
    .single()

  if (!existing || existing.venue_id !== venue.id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  // Cancel instead of hard delete
  const { error } = await supabase
    .from("sessions")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
