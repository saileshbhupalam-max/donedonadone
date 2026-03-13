import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getInitials } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, ExternalLink, Flame, Link2, Dna } from "lucide-react";
import { TierBadge } from "@/components/ui/TierBadge";
import type { TierId } from "@/hooks/useSubscription";
import { getBadgeDef } from "@/lib/badges";
import { getRankForHours } from "@/lib/ranks";
import { RankAvatar } from "@/components/gamification/RankAvatar";
import { RankBadge } from "@/components/gamification/RankBadge";
import { AchievementsSection } from "@/components/gamification/AchievementsSection";
import { CurrentMonthTitleBanner } from "@/components/gamification/MonthlyTitlesSection";
import { PropsReceived } from "@/components/session/GivePropsFlow";
import { format, parseISO } from "date-fns";
import { usePageTitle } from "@/hooks/usePageTitle";
import { trackAnalyticsEvent } from "@/lib/growth";
import { CaptainBadge } from "@/components/captain/CaptainCard";
import { SendConnectionRequest } from "@/components/connections/SendConnectionRequest";
import { toast } from "sonner";

interface PublicProfile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  work_type: string | null;
  events_attended: number;
  member_since: string | null;
  role_type: string | null;
  skills: string[] | null;
  looking_for: string[] | null;
  can_offer: string[] | null;
  topics: string[] | null;
  values: string[] | null;
  work_style: Record<string, string | null> | null;
  company: string | null;
  company_visible: boolean;
  taste_match_score: number;
  connection_type: string | null;
  connection_strength: number | null;
  mutual_sessions: number;
}

function MatchRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;
  const label = score >= 80 ? "Great match!" : score >= 60 ? "Good match" : score >= 40 ? "Worth a chat" : "";

  if (score < 40) return null;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-20 h-20">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="40" fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
          <circle cx="48" cy="48" r="40" fill="none"
            stroke={score >= 80 ? "hsl(var(--primary))" : "hsl(var(--secondary))"}
            strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-foreground">
          {score}%
        </span>
      </div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

const workStyleLabels: Record<string, Record<string, string>> = {
  group_size_pref: { small: "Small groups", large: "Large groups", any: "Any size" },
  conversation_depth: { light: "Light chats", medium: "Medium depth", deep: "Deep convos" },
  session_length_pref: { short: "Short sessions", medium: "Medium sessions", long: "Long sessions" },
  noise_preference: { silent: "Prefers silence", low_hum: "Background buzz", dont_care: "Flexible" },
  communication_style: { minimal: "Focused", moderate: "Goes with the flow", chatty: "Chatty" },
};

function ProfileActions({ isOwnProfile, profileData, navigate }: { isOwnProfile: boolean; profileData: PublicProfile; navigate: (path: string | number) => void }) {
  const [connectOpen, setConnectOpen] = useState(false);

  if (isOwnProfile) {
    return (
      <div className="px-4 mt-5 space-y-2">
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => navigate("/me")}>Edit Profile</Button>
          <Button variant="outline" className="flex-1" onClick={() => navigate("/me/dna")}>
            <Dna className="w-4 h-4 mr-1" /> Edit DNA
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 mt-5 space-y-2">
      <Button className="w-full" onClick={() => setConnectOpen(true)}>
        Connect
      </Button>
      <SendConnectionRequest
        open={connectOpen}
        onOpenChange={setConnectOpen}
        targetUser={{
          id: profileData.user_id,
          display_name: profileData.display_name,
          avatar_url: profileData.avatar_url,
        }}
      />
    </div>
  );
}

export default function ProfileView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile: myProfile, user } = useAuth();
  const [profileData, setProfileData] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [badges, setBadges] = useState<string[]>([]);
  const [focusHours, setFocusHours] = useState(0);
  const [subTier, setSubTier] = useState<TierId>("free");
  const [engagementScore, setEngagementScore] = useState<number | null>(null);

  const isOwnProfile = user?.id === id;
  usePageTitle(profileData ? `${profileData.display_name}'s Profile — FocusClub` : "Profile — FocusClub");

  useEffect(() => {
    if (!id || !user) return;

    const load = async () => {
      const [profileRes, badgesRes, hoursRes] = await Promise.all([
        supabase.rpc("get_public_profile", { p_viewer_id: user.id, p_profile_id: id }),
        supabase.from("member_badges").select("badge_type").eq("user_id", id),
        supabase.from("profiles").select("focus_hours, subscription_tier").eq("id", id).single(),
      ]);

      if (profileRes.error || !profileRes.data || (Array.isArray(profileRes.data) && profileRes.data.length === 0)) {
        setNotFound(true);
      } else {
        const row = Array.isArray(profileRes.data) ? profileRes.data[0] : profileRes.data;
        setProfileData(row as PublicProfile);
      }

      setBadges((badgesRes.data || []).map((b) => b.badge_type));
      setFocusHours(Number(hoursRes.data?.focus_hours ?? 0));
      setSubTier((hoursRes.data?.subscription_tier || "free") as TierId);

      // Fetch engagement score for own profile
      if (user.id === id) {
        supabase
          .from("user_engagement_scores")
          .select("score")
          .eq("user_id", id)
          .maybeSingle()
          .then(({ data: scoreData }) => {
            if (scoreData) setEngagementScore(scoreData.score);
          });
      }

      setLoading(false);

      // Track profile view
      if (user.id !== id) {
        supabase.from("profile_views").upsert({
          viewer_id: user.id,
          viewed_id: id,
          viewed_at: new Date().toISOString().split("T")[0],
        }, { onConflict: "viewer_id,viewed_id,viewed_at" }).then(() => {});
        trackAnalyticsEvent("profile_view", user.id, { viewed_id: id }).catch(() => {});
      }
    };

    load();
  }, [id, user]);

  if (loading) {
    return (
      <AppShell>
        <div className="px-4 pt-4 space-y-4">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-20 w-20 rounded-full" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (notFound || !profileData) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] gap-4 px-6">
          <p className="text-muted-foreground text-center">This person isn't on FocusClub yet.</p>
          <Button variant="outline" onClick={() => navigate(-1)}>Go back</Button>
        </div>
      </AppShell>
    );
  }

  const rank = getRankForHours(focusHours);
  const memberSince = profileData.member_since ? format(parseISO(profileData.member_since), "MMMM yyyy") : null;
  const hasDna = !!(profileData.role_type || (profileData.skills && profileData.skills.length > 0) || (profileData.topics && profileData.topics.length > 0));
  const ws = profileData.work_style || {};

  return (
    <AppShell>
      <div className="pb-8">
        {/* Back */}
        <div className="px-4 pt-3">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px]">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>

        {/* Hero */}
        <div className="flex flex-col items-center px-4 mt-4 gap-2">
          <RankAvatar avatarUrl={profileData.avatar_url} displayName={profileData.display_name} focusHours={focusHours} size="xl" />

          <div className="flex items-center gap-2 mt-1">
            <h1 className="font-serif text-2xl text-foreground">{profileData.display_name || "Member"}</h1>
            <RankBadge focusHours={focusHours} size="sm" />
            <TierBadge tier={subTier} size="md" />
          </div>

          {profileData.bio && <p className="text-sm text-muted-foreground text-center max-w-xs">{profileData.bio}</p>}

          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap justify-center">
            {focusHours > 0 && <span>🕐 {focusHours} Focus Hours</span>}
            {memberSince && <span>Member since {memberSince}</span>}
            {profileData.events_attended > 0 && <span>🎪 {profileData.events_attended} sessions</span>}
          </div>

          {/* Engagement indicator (own profile only) */}
          {isOwnProfile && engagementScore !== null && engagementScore >= 20 && (
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={`w-2 h-2 rounded-full ${engagementScore >= 50 ? "bg-emerald-400" : "bg-amber-400"}`} />
              {engagementScore >= 50 ? "Active member" : "Growing"}
            </span>
          )}

          {/* Connection badge */}
          {!isOwnProfile && profileData.connection_type && (
            <Badge variant="secondary" className="gap-1">
              <Link2 className="w-3 h-3" />
              Connected
              {profileData.connection_strength && profileData.connection_strength > 50 && " · Strong"}
            </Badge>
          )}

          {/* Mutual sessions */}
          {!isOwnProfile && profileData.mutual_sessions > 0 && (
            <span className="text-xs bg-secondary/10 text-secondary-foreground px-3 py-1 rounded-full">
              🤝 {profileData.mutual_sessions} mutual session{profileData.mutual_sessions !== 1 ? "s" : ""}
            </span>
          )}

          <CurrentMonthTitleBanner userId={id!} displayName={profileData.display_name || "Member"} />

          {badges.length > 0 && (
            <div className="flex gap-1.5 flex-wrap justify-center">
              {badges.map((bt) => {
                const def = getBadgeDef(bt);
                if (!def) return null;
                return (
                  <Tooltip key={bt}>
                    <TooltipTrigger asChild>
                      <span className="text-lg cursor-default">{def.emoji}</span>
                    </TooltipTrigger>
                    <TooltipContent><p className="text-xs">{def.name}</p></TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}
        </div>

        {/* Taste match */}
        {!isOwnProfile && profileData.taste_match_score >= 40 && (
          <div className="flex justify-center mt-4">
            <MatchRing score={profileData.taste_match_score} />
          </div>
        )}

        {/* Content sections */}
        <div className="px-4 mt-5 space-y-3">
          {/* Work summary */}
          {profileData.work_type && (
            <Card>
              <CardContent className="pt-4">
                <h3 className="font-serif text-base text-foreground mb-1">What I Do</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{profileData.work_type}</p>
              </CardContent>
            </Card>
          )}

          {/* Work DNA section */}
          {hasDna ? (
            <Card>
              <CardContent className="pt-4 space-y-4">
                <h3 className="font-serif text-base text-foreground flex items-center gap-2">
                  <Dna className="w-4 h-4 text-primary" /> Work DNA
                </h3>

                {profileData.role_type && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Role</p>
                    <Badge variant="outline">{profileData.role_type}</Badge>
                  </div>
                )}

                {profileData.company && profileData.company_visible && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Current Project</p>
                    <p className="text-sm text-foreground">{profileData.company}</p>
                  </div>
                )}

                {(profileData.skills?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {profileData.skills!.slice(0, 10).map(s => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {(profileData.looking_for?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Looking for</p>
                      <div className="flex flex-wrap gap-1">
                        {profileData.looking_for!.map(t => (
                          <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(profileData.can_offer?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Can offer</p>
                      <div className="flex flex-wrap gap-1">
                        {profileData.can_offer!.map(t => (
                          <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-secondary/15 text-secondary-foreground">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {(profileData.topics?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Topics</p>
                    <div className="flex flex-wrap gap-1">
                      {profileData.topics!.map(t => (
                        <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {(profileData.values?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Values</p>
                    <div className="flex flex-wrap gap-1">
                      {profileData.values!.map(v => (
                        <Badge key={v} variant="outline" className="text-xs">{v}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Work style prefs */}
                {Object.entries(ws).some(([, v]) => v) && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Work Style</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(ws).map(([key, val]) => {
                        if (!val) return null;
                        const label = workStyleLabels[key]?.[val] || val;
                        return <Badge key={key} variant="outline" className="text-xs">{label}</Badge>;
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">This person hasn't built their Work DNA yet.</p>
              </CardContent>
            </Card>
          )}

          {/* Props Received */}
          <PropsReceived userId={id!} />

          {/* Achievements */}
          <AchievementsSection userId={id!} />
        </div>

        {/* Actions */}
        <ProfileActions
          isOwnProfile={isOwnProfile}
          profileData={profileData}
          navigate={navigate}
        />
      </div>
    </AppShell>
  );
}
