import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { User, Mail, Briefcase, MapPin } from "lucide-react"

const workTypeLabels: Record<string, string> = {
  freelancer: "Freelancer",
  startup_founder: "Startup Founder",
  remote_employee: "Remote Employee",
  student: "Student",
  creator: "Creator",
  other: "Other",
}

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user?.id || "")
    .single()

  const { data: preferences } = await supabase
    .from("coworker_preferences")
    .select("*")
    .eq("user_id", user?.id || "")
    .single()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Profile</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your coworking profile and preferences
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile info */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">
              Personal Info
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
                {profile?.display_name?.charAt(0)?.toUpperCase() ||
                  profile?.full_name?.charAt(0)?.toUpperCase() ||
                  "U"}
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">
                  {profile?.full_name || "Not set"}
                </p>
                {profile?.display_name && (
                  <p className="text-sm text-muted-foreground">
                    @{profile.display_name}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">{user?.email}</span>
              </div>
              {profile?.city && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{profile.city}</span>
                </div>
              )}
              {profile?.work_type && (
                <div className="flex items-center gap-3 text-sm">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">
                    {workTypeLabels[profile.work_type] || profile.work_type}
                  </span>
                </div>
              )}
            </div>

            {profile?.bio && (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {profile.bio}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">
              Work Preferences
            </CardTitle>
          </CardHeader>
          <CardContent>
            {preferences ? (
              <div className="flex flex-col gap-4">
                {preferences.preferred_vibe && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Work Vibe
                    </p>
                    <Badge variant="secondary" className="mt-1">
                      {preferences.preferred_vibe.replace("_", " ")}
                    </Badge>
                  </div>
                )}
                {preferences.noise_preference && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Noise
                    </p>
                    <Badge variant="secondary" className="mt-1">
                      {preferences.noise_preference}
                    </Badge>
                  </div>
                )}
                {preferences.communication_style && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Communication
                    </p>
                    <Badge variant="secondary" className="mt-1">
                      {preferences.communication_style}
                    </Badge>
                  </div>
                )}
                {preferences.interests && preferences.interests.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Interests
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {preferences.interests.map((interest: string) => (
                        <Badge key={interest} variant="outline">
                          {interest}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 text-center">
                <User className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  Complete your profile quiz to get better group matches
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
