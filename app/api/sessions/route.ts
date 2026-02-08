import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = request.nextUrl

  const vibe = searchParams.get("vibe")
  const date = searchParams.get("date")
  const city = searchParams.get("city")
  const search = searchParams.get("search")

  let query = supabase
    .from("sessions")
    .select("*, venues(*)")
    .eq("status", "upcoming")
    .gte("session_date", new Date().toISOString().split("T")[0])
    .order("session_date", { ascending: true })

  if (vibe && vibe !== "all") {
    query = query.eq("vibe", vibe)
  }

  if (date) {
    query = query.eq("session_date", date)
  }

  if (city) {
    query = query.eq("venues.city", city)
  }

  const { data: sessions, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Client-side search filter (title or venue name)
  let filtered = sessions || []
  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter(
      (s) =>
        s.title?.toLowerCase().includes(q) ||
        s.venues?.name?.toLowerCase().includes(q) ||
        s.venues?.address?.toLowerCase().includes(q)
    )
  }

  return NextResponse.json({ sessions: filtered })
}
