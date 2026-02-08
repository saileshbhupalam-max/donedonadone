import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { verifyAdmin } from "@/lib/admin"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await verifyAdmin(supabase, user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const { status } = body

  if (!status || !["active", "inactive", "pending"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  const { error } = await supabase
    .from("venues")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
