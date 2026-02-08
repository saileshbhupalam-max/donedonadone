import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { booking_id } = body

  if (!booking_id) {
    return NextResponse.json(
      { error: "booking_id is required" },
      { status: 400 }
    )
  }

  const { error } = await supabase.rpc("cancel_booking", {
    p_booking_id: booking_id,
    p_user_id: user.id,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
