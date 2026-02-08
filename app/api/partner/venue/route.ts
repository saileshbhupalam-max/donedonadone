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

  const { data: venue, error } = await supabase
    .from("venues")
    .select("*")
    .eq("partner_id", user.id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json({ venue })
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const {
    name,
    address,
    area,
    venue_type,
    amenities,
    included_in_cover,
    venue_rules,
    max_capacity,
  } = body

  const { data: venue, error } = await supabase
    .from("venues")
    .update({
      name,
      address,
      area,
      venue_type,
      amenities,
      included_in_cover,
      venue_rules,
      max_capacity,
      updated_at: new Date().toISOString(),
    })
    .eq("partner_id", user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ venue })
}
