import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminShell } from "@/components/admin/admin-shell"

export default async function AdminLayout({
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, user_type")
    .eq("id", user.id)
    .single()

  if (!profile || profile.user_type !== "admin") {
    redirect("/dashboard")
  }

  const userName =
    profile.display_name ||
    user.user_metadata?.display_name ||
    user.email?.split("@")[0] ||
    null

  return <AdminShell userName={userName}>{children}</AdminShell>
}
