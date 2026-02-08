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

  const { searchParams } = request.nextUrl
  const status = searchParams.get("status") || ""
  const dateFrom = searchParams.get("date_from") || ""
  const dateTo = searchParams.get("date_to") || ""

  let query = supabase
    .from("sessions")
    .select("*, venues(name, address)")
    .order("date", { ascending: false })
    .order("start_time", { ascending: true })

  if (status && status !== "all") {
    query = query.eq("status", status)
  }
  if (dateFrom) {
    query = query.gte("date", dateFrom)
  }
  if (dateTo) {
    query = query.lte("date", dateTo)
  }

  const { data: sessions, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ sessions: sessions || [] })
}
