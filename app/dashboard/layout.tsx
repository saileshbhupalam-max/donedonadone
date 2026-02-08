import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"

export default async function DashboardLayout({
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

  // Check onboarding status
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_complete, display_name, full_name")
    .eq("id", user.id)
    .single()

  if (!profile?.onboarding_complete) {
    redirect("/onboarding")
  }

  const userName =
    profile?.display_name ||
    profile?.full_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.display_name ||
    user.email?.split("@")[0] ||
    null

  return <DashboardShell userName={userName}>{children}</DashboardShell>
}
