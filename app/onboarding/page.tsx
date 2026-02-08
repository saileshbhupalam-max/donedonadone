import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const params = await searchParams
  const isEdit = params.edit === "true"

  // If already onboarded and not editing, go to dashboard
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_complete, display_name, phone, work_type, industry, bio")
    .eq("id", user.id)
    .single()

  if (profile?.onboarding_complete && !isEdit) {
    redirect("/dashboard")
  }

  // Load existing preferences for pre-fill when editing
  let existingPrefs = null
  if (isEdit) {
    const { data: prefs } = await supabase
      .from("coworker_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single()
    existingPrefs = prefs
  }

  const initialData = isEdit && profile
    ? {
        display_name: profile.display_name || "",
        phone: profile.phone || "",
        work_type: profile.work_type || "",
        industry: profile.industry || "",
        bio: profile.bio || "",
        preferred_vibe: existingPrefs?.preferred_vibe || "",
        noise_preference: existingPrefs?.noise_preference || "",
        break_frequency: existingPrefs?.break_frequency || "",
        productive_times: existingPrefs?.productive_times || [],
        social_goals: existingPrefs?.social_goals || [],
        introvert_extrovert: existingPrefs?.introvert_extrovert || 3,
        communication_style: existingPrefs?.communication_style || "",
        interests: existingPrefs?.interests || [],
      }
    : undefined

  return <OnboardingWizard initialData={initialData} />
}
