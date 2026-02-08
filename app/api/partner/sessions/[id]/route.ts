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

  const { data: session, error } = await supabase
    .from("sessions")
    .update({
      ...body,
      updated_at: new Date().toISOString(),
    })
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
