import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PartnerShell } from "@/components/partner/partner-shell"

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Check profile + user_type
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, full_name, user_type")
    .eq("id", user.id)
    .single()

  if (!profile || profile.user_type !== "partner") {
    redirect("/dashboard")
  }

  // Fetch partner's venue
  const { data: venue } = await supabase
    .from("venues")
    .select("name")
    .eq("partner_id", user.id)
    .single()

  const userName =
    profile.display_name ||
    profile.full_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.display_name ||
    user.email?.split("@")[0] ||
    null

  return (
    <PartnerShell userName={userName} venueName={venue?.name || null}>
      {children}
    </PartnerShell>
  )
}
