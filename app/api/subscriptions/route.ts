import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// GET: List subscription plans + user's current subscription
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Get all active plans
  const { data: plans } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("active", true)
    .order("price", { ascending: true })

  // Get user's active subscription
  const { data: subscription } = await supabase
    .from("user_subscriptions")
    .select("*, subscription_plans(*)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single()

  return NextResponse.json({
    plans: plans || [],
    subscription: subscription || null,
  })
}

// POST: Create a new subscription
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { plan_id } = body

  if (!plan_id) {
    return NextResponse.json({ error: "Plan ID required" }, { status: 400 })
  }

  // Check for existing active subscription
  const { data: existing } = await supabase
    .from("user_subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single()

  if (existing) {
    return NextResponse.json({ error: "Already have an active subscription" }, { status: 400 })
  }

  // Verify plan exists
  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("id", plan_id)
    .eq("active", true)
    .single()

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 })
  }

  const now = new Date()
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())

  const { data: subscription, error } = await supabase
    .from("user_subscriptions")
    .insert({
      user_id: user.id,
      plan_id,
      status: "active",
      current_period_start: now.toISOString().split("T")[0],
      current_period_end: periodEnd.toISOString().split("T")[0],
      sessions_used: 0,
    })
    .select("*, subscription_plans(*)")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ subscription })
}
