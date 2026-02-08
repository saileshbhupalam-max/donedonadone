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
  const search = searchParams.get("search") || ""
  const type = searchParams.get("type") || ""
  const page = parseInt(searchParams.get("page") || "1")
  const limit = 20
  const offset = (page - 1) * limit

  let query = supabase
    .from("profiles")
    .select("*, coworker_preferences(*)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.ilike("display_name", `%${search}%`)
  }
  if (type && type !== "all") {
    query = query.eq("user_type", type)
  }

  const { data: users, count, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    users: users || [],
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  })
}
