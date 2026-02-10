import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// GET: Get user's referral code and referral history
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Get referral code
  const { data: referralCode } = await supabase
    .from("referral_codes")
    .select("*")
    .eq("user_id", user.id)
    .single()

  // Get referral events (people who used this user's code)
  const { data: referrals } = await supabase
    .from("referral_events")
    .select("*, profiles:referred_id(display_name)")
    .eq("referrer_id", user.id)
    .order("created_at", { ascending: false })

  return NextResponse.json({
    code: referralCode || null,
    referrals: referrals || [],
    totalEarned: (referrals || []).reduce((sum, r) => sum + (r.credit_amount || 0), 0),
  })
}

// POST: Apply a referral code (called during/after signup)
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { code } = body

  if (!code) {
    return NextResponse.json({ error: "Referral code required" }, { status: 400 })
  }

  // Check if user was already referred
  const { data: existingReferral } = await supabase
    .from("referral_events")
    .select("id")
    .eq("referred_id", user.id)
    .single()

  if (existingReferral) {
    return NextResponse.json({ error: "Already referred" }, { status: 400 })
  }

  // Find the referral code
  const { data: referralCode } = await supabase
    .from("referral_codes")
    .select("*")
    .eq("code", code.toUpperCase())
    .single()

  if (!referralCode) {
    return NextResponse.json({ error: "Invalid referral code" }, { status: 404 })
  }

  // Can't refer yourself
  if (referralCode.user_id === user.id) {
    return NextResponse.json({ error: "Cannot use your own code" }, { status: 400 })
  }

  // Check referral cap (max_uses)
  if (referralCode.max_uses && referralCode.uses >= referralCode.max_uses) {
    return NextResponse.json({ error: "This referral code has reached its limit" }, { status: 400 })
  }

  // Create referral event
  const { error } = await supabase.from("referral_events").insert({
    referrer_id: referralCode.user_id,
    referred_id: user.id,
    code: referralCode.code,
    credit_amount: 50,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Increment uses count
  await supabase
    .from("referral_codes")
    .update({ uses: referralCode.uses + 1 })
    .eq("id", referralCode.id)

  return NextResponse.json({ success: true, credit: 50 })
}
