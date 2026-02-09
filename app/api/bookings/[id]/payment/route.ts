import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { generateUPILink } from "@/lib/payments"

// POST: Generate UPI payment link for a booking
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: bookingId } = await params

  // Get booking details
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, user_id, payment_amount, payment_status")
    .eq("id", bookingId)
    .eq("user_id", user.id)
    .single()

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  if (booking.payment_status !== "pending") {
    return NextResponse.json({ error: "Payment already initiated or completed" }, { status: 400 })
  }

  // Generate UPI link
  const upiLink = generateUPILink({
    amount: booking.payment_amount,
    bookingId: booking.id,
  })

  // Update booking status to payment_pending
  await supabase
    .from("bookings")
    .update({ payment_status: "payment_pending" })
    .eq("id", bookingId)

  return NextResponse.json({ upiLink, amount: booking.payment_amount })
}

// PATCH: Mark payment as "I've paid" (user confirms)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: bookingId } = await params
  const body = await request.json()
  const { upi_ref } = body

  // Verify booking belongs to user
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, user_id, payment_status")
    .eq("id", bookingId)
    .eq("user_id", user.id)
    .single()

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  if (booking.payment_status !== "payment_pending" && booking.payment_status !== "pending") {
    return NextResponse.json({ error: "Invalid payment state" }, { status: 400 })
  }

  // Update with payment reference — admin will verify
  await supabase
    .from("bookings")
    .update({
      payment_status: "paid",
      payment_reference: upi_ref || null,
    })
    .eq("id", bookingId)

  return NextResponse.json({ success: true })
}
