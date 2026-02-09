import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  User,
  Mail,
  Briefcase,
  MapPin,
  Phone,
  Calendar,
  Pencil,
  Headphones,
  MessageCircle,
  Zap,
  VolumeX,
  Music,
  Volume2,
  Timer,
  Clock,
  Hourglass,
  Shuffle,
  Sun,
  CloudSun,
  Sunset,
  Moon,
  Share2,
  Copy,
  TrendingUp,
  Users,
  CalendarCheck,
  Star,
  Flame,
} from "lucide-react"
import { SignOutButton } from "@/components/dashboard/sign-out-button"
import { getTrustTier } from "@/lib/config"

const workTypeLabels: Record<string, string> = {
  freelancer: "Freelancer",
  startup_founder: "Startup Founder",
  remote_employee: "Remote Employee",
  student: "Student",
  creator: "Creator",
  other: "Other",
}

const vibeLabels: Record<string, { label: string; icon: typeof Headphones }> = {
  deep_focus: { label: "Deep Focus", icon: Headphones },
  casual_social: { label: "Casual & Social", icon: MessageCircle },
  balanced: { label: "Balanced", icon: Zap },
}

const noiseLabels: Record<string, { label: string; icon: typeof VolumeX }> = {
  silent: { label: "Library quiet", icon: VolumeX },
  ambient: { label: "Ambient buzz", icon: Music },
  lively: { label: "Lively energy", icon: Volume2 },
}

const breakLabels: Record<string, { label: string; icon: typeof Timer }> = {
  pomodoro: { label: "Every 25-30 min", icon: Timer },
  hourly: { label: "Every hour", icon: Clock },
  deep_stretch: { label: "2+ hours straight", icon: Hourglass },
  flexible: { label: "Whenever", icon: Shuffle },
}

const commLabels: Record<string, string> = {
  minimal: "Minimal",
  moderate: "Moderate",
  chatty: "Chatty",
}

const timeIcons: Record<string, typeof Sun> = {
  morning: Sun,
  afternoon: CloudSun,
  evening: Sunset,
  night: Moon,
}

const introExtroLabels = [
  "Very introverted",
  "Introverted",
  "Ambivert",
  "Extroverted",
  "Very extroverted",
]

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

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      })
    : "Unknown"

  // Fetch user stats
  let userStats = { sessions_completed: 0, unique_coworkers: 0, venues_visited: 0, avg_rating_received: 0, hours_focused: 0 }
  const { data: statsData } = await supabase.rpc("get_user_stats", { p_user_id: user?.id || "" })
  if (statsData) userStats = statsData

  // Fetch reputation score
  let reputation = { score: 0, attendance: 0, cowork_again_rate: 0, avg_energy: 0, session_score: 0, streak_score: 0, feedback_score: 0, total_ratings: 0, sessions_completed: 0 }
  const { data: repData } = await supabase.rpc("compute_coworker_score", { p_user_id: user?.id || "" })
  if (repData) reputation = repData

  // Fetch streak
  const { data: streakData } = await supabase
    .from("user_streaks")
    .select("current_streak, longest_streak")
    .eq("user_id", user?.id || "")
    .single()

  // Fetch referral code
  const { data: referralCode } = await supabase
    .from("referral_codes")
    .select("code, uses")
    .eq("user_id", user?.id || "")
    .single()

  const tier = getTrustTier(userStats.sessions_completed)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Profile</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your coworking identity and preferences
        </p>
      </div>

      {/* ---- Coworker Card Preview ---- */}
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-secondary to-teal-700">
        <CardContent className="p-6">
          <p className="mb-4 text-xs font-medium uppercase tracking-wider text-teal-200">
            How others see you
          </p>
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 text-3xl font-bold text-white">
              {profile?.display_name?.charAt(0)?.toUpperCase() ||
                profile?.full_name?.charAt(0)?.toUpperCase() ||
                "U"}
            </div>
            <div>
              <p className="text-xl font-bold text-white">
                {profile?.display_name || profile?.full_name || "Anonymous"}
              </p>
              <p className="text-sm text-teal-100">
                {workTypeLabels[profile?.work_type] || "Coworker"}
                {profile?.industry ? ` \u00B7 ${profile.industry}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {preferences?.preferred_vibe &&
                vibeLabels[preferences.preferred_vibe] && (
                  <Badge className="bg-white/20 text-white hover:bg-white/30">
                    {vibeLabels[preferences.preferred_vibe].label}
                  </Badge>
                )}
              {preferences?.communication_style && (
                <Badge className="bg-white/20 text-white hover:bg-white/30">
                  {commLabels[preferences.communication_style] || preferences.communication_style}
                </Badge>
              )}
              {preferences?.noise_preference &&
                noiseLabels[preferences.noise_preference] && (
                  <Badge className="bg-white/20 text-white hover:bg-white/30">
                    {noiseLabels[preferences.noise_preference].label}
                  </Badge>
                )}
            </div>
            {profile?.bio && (
              <p className="max-w-sm text-sm leading-relaxed text-teal-100">
                {profile.bio}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ---- Stats & Reputation ---- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-border">
          <CardContent className="flex flex-col items-center gap-1 p-4 text-center">
            <CalendarCheck className="h-5 w-5 text-primary" />
            <p className="text-2xl font-bold text-foreground">{userStats.sessions_completed}</p>
            <p className="text-xs text-muted-foreground">Sessions</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="flex flex-col items-center gap-1 p-4 text-center">
            <Users className="h-5 w-5 text-secondary" />
            <p className="text-2xl font-bold text-foreground">{userStats.unique_coworkers}</p>
            <p className="text-xs text-muted-foreground">People Met</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="flex flex-col items-center gap-1 p-4 text-center">
            <Star className="h-5 w-5 text-amber-500" />
            <p className="text-2xl font-bold text-foreground">{reputation.score || "—"}</p>
            <p className="text-xs text-muted-foreground">Coworker Score</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="flex flex-col items-center gap-1 p-4 text-center">
            <Flame className="h-5 w-5 text-orange-500" />
            <p className="text-2xl font-bold text-foreground">{streakData?.current_streak || 0}</p>
            <p className="text-xs text-muted-foreground">Week Streak</p>
          </CardContent>
        </Card>
      </div>

      {/* ---- Trust Tier ---- */}
      <Card className="border-border">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 ${tier.className}`}>
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-semibold">{tier.label}</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {userStats.sessions_completed} sessions completed
            </span>
          </div>
          {streakData?.longest_streak ? (
            <span className="text-xs text-muted-foreground">
              Longest streak: {streakData.longest_streak}w
            </span>
          ) : null}
        </CardContent>
      </Card>

      {/* ---- Referral Code ---- */}
      {referralCode && (
        <Card className="border-border">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Share2 className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Your Referral Code</p>
                <p className="font-mono text-lg font-bold text-primary">{referralCode.code}</p>
                <p className="text-xs text-muted-foreground">
                  {referralCode.uses} referral{referralCode.uses !== 1 ? "s" : ""} used
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {}}
              title="Share link will be copied"
            >
              <Copy className="mr-1 h-3 w-3" />
              Copy
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* ---- Personal Info ---- */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base text-foreground">
              Personal Info
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
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

            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">{user?.email}</span>
              </div>
              {profile?.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">+91 {profile.phone}</span>
                </div>
              )}
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
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Member since {memberSince}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ---- Preferences ---- */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base text-foreground">
              Work Preferences
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <a href="/onboarding?edit=true">
                <Pencil className="mr-1 h-3 w-3" /> Edit
              </a>
            </Button>
          </CardHeader>
          <CardContent>
            {preferences ? (
              <div className="flex flex-col gap-5">
                {/* Vibe */}
                {preferences.preferred_vibe &&
                  vibeLabels[preferences.preferred_vibe] && (
                    <PrefRow
                      label="Work vibe"
                      icon={vibeLabels[preferences.preferred_vibe].icon}
                      value={vibeLabels[preferences.preferred_vibe].label}
                    />
                  )}

                {/* Noise */}
                {preferences.noise_preference &&
                  noiseLabels[preferences.noise_preference] && (
                    <PrefRow
                      label="Noise"
                      icon={noiseLabels[preferences.noise_preference].icon}
                      value={noiseLabels[preferences.noise_preference].label}
                    />
                  )}

                {/* Break frequency */}
                {preferences.break_frequency &&
                  breakLabels[preferences.break_frequency] && (
                    <PrefRow
                      label="Breaks"
                      icon={breakLabels[preferences.break_frequency].icon}
                      value={breakLabels[preferences.break_frequency].label}
                    />
                  )}

                {/* Communication style */}
                {preferences.communication_style && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Communication
                    </p>
                    <p className="mt-1 text-sm font-medium capitalize text-foreground">
                      {commLabels[preferences.communication_style] ||
                        preferences.communication_style}
                    </p>
                  </div>
                )}

                {/* Personality */}
                {preferences.introvert_extrovert && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Personality
                    </p>
                    <div className="mt-2 flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((v) => (
                        <div
                          key={v}
                          className={`h-2.5 w-6 rounded-full ${
                            v <= preferences.introvert_extrovert
                              ? "bg-primary"
                              : "bg-muted"
                          }`}
                        />
                      ))}
                      <span className="ml-2 text-sm text-foreground">
                        {introExtroLabels[(preferences.introvert_extrovert || 3) - 1]}
                      </span>
                    </div>
                  </div>
                )}

                {/* Productive times */}
                {preferences.productive_times &&
                  preferences.productive_times.length > 0 && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Productive times
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {preferences.productive_times.map((t: string) => {
                          const Icon = timeIcons[t] || Sun
                          return (
                            <Badge
                              key={t}
                              variant="outline"
                              className="gap-1 capitalize"
                            >
                              <Icon className="h-3 w-3" />
                              {t}
                            </Badge>
                          )
                        })}
                      </div>
                    </div>
                  )}

                {/* Social goals */}
                {preferences.social_goals &&
                  preferences.social_goals.length > 0 && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Coworking goals
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {preferences.social_goals.map((g: string) => (
                          <Badge key={g} variant="secondary" className="capitalize">
                            {g}
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
                <Button size="sm" className="mt-3" asChild>
                  <a href="/onboarding?edit=true">Take the Quiz</a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---- Account & Sign out ---- */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Account</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Email</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          {profile?.phone && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Phone</p>
                <p className="text-sm text-muted-foreground">
                  +91 {profile.phone}
                </p>
              </div>
            </div>
          )}
          <div className="border-t border-border pt-4">
            <SignOutButton />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function PrefRow({
  label,
  icon: Icon,
  value,
}: {
  label: string
  icon: React.ElementType
  value: string
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground">{value}</span>
      </div>
    </div>
  )
}
