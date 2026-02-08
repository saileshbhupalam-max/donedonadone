import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { verifyAdmin } from "@/lib/admin"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await verifyAdmin(supabase, user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { data: venues, error } = await supabase
    .from("venues")
    .select("*, profiles!venues_partner_id_fkey(display_name)")
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ venues: venues || [] })
}
