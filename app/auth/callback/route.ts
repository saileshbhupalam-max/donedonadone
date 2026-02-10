import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// OAuth callback handler — handles both OAuth sign-in and password recovery
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get("code")
  const type = searchParams.get("type")

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Password recovery — redirect to dashboard (they'll be prompted to update)
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/dashboard`)
      }
      // OAuth or email verification — redirect to onboarding
      return NextResponse.redirect(`${origin}/onboarding`)
    }
  }

  // If code exchange fails, redirect to error page
  return NextResponse.redirect(`${origin}/auth/error`)
}
