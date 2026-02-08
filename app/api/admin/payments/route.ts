import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { verifyAdmin } from "@/lib/admin"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await verifyAdmin(supabase, user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // Pending payments = bookings with payment_status = 'pending' or 'payment_pending'
  const { data: payments } = await supabase
    .from("bookings")
    .select("id, user_id, payment_amount, payment_status, payment_reference, created_at, profiles!bookings_user_id_fkey(display_name), sessions(date, start_time, venues(name))")
    .in("payment_status", ["pending", "payment_pending"])
    .order("created_at", { ascending: false })

  return NextResponse.json({ payments: payments || [] })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await verifyAdmin(supabase, user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const { booking_id, action } = body

  if (!booking_id || !action) {
    return NextResponse.json({ error: "booking_id and action required" }, { status: 400 })
  }

  const newStatus = action === "verify" ? "confirmed" : action === "reject" ? "cancelled" : null
  if (!newStatus) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  const { error } = await supabase
    .from("bookings")
    .update({ payment_status: newStatus })
    .eq("id", booking_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
