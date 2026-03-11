/* DESIGN: Profile restructured into 3 tabs:
   - Profile: What others see (screenshot-worthy)
   - Journey: Your FocusClub story (timeline)
   - Settings: Edit everything */

import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getInitials } from "@/lib/utils";
import { AppShell } from "@/components/layout/AppShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TagInput } from "@/components/onboarding/TagInput";
import { useToast } from "@/hooks/use-toast";
import { calculateProfileCompletion } from "@/lib/matchUtils";
import { checkAndAwardBadges, BADGE_DEFINITIONS, getBadgeDef } from "@/lib/badges";
import { useTheme } from "@/hooks/useTheme";
import { Camera, LogOut, Sun, Moon, Monitor, Lock, Download, Share2, MessageCircle, Copy, Navigation, Settings, Eye } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton as UISkeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/hooks/usePageTitle";
import { ERROR_STATES, CONFIRMATIONS } from "@/lib/personality";
import { format } from "date-fns";
import { ShareProfileCard } from "@/components/sharing/ProfileCard";
import { WhatsAppShareButton, CopyLinkButton } from "@/components/sharing/WhatsAppButton";
import { getProfileShareMessage, getBadgeShareMessage } from "@/lib/sharing";
import { toast as sonnerToast } from "sonner";
import { getRankForHours, getNextRank, getRankProgress, ACHIEVEMENT_DEFS, getAchievementDef, MONTHLY_TITLE_DEFS } from "@/lib/ranks";
import { ScrapbookCard, type ScrapbookEntry } from "@/components/session/ScrapbookCard";
import { RankAvatar } from "@/components/gamification/RankAvatar";
import { RankBadge } from "@/components/gamification/RankBadge";
import { CaptainOptInCard, CaptainBadge } from "@/components/captain/CaptainCard";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { motion } from "framer-motion";

const LocationPicker = lazy(() => import("@/components/map/LocationPicker").then(m => ({ default: m.LocationPicker })));

const vibeOptions = [
  { value: "deep_focus", label: "Deep Focus", emoji: "🎯", desc: "Heads-down, get stuff done" },
  { value: "casual_social", label: "Casual Social", emoji: "☕", desc: "Here for vibes and conversation" },
  { value: "balanced", label: "Balanced", emoji: "⚖️", desc: "Depends on the day" },
];
const genderOptions = [
  { value: "woman", label: "Woman" }, { value: "man", label: "Man" },
  { value: "non_binary", label: "Non-binary" }, { value: "prefer_not_to_say", label: "Prefer not to say" },
];
const noiseOptions = [
  { value: "silent", emoji: "🤫", label: "Silent" },
  { value: "low_hum", emoji: "🎵", label: "Low Hum" },
  { value: "dont_care", emoji: "🤷", label: "Don't Care" },
];
const commOptions = [
  { value: "minimal", emoji: "🧘", label: "Minimal" },
  { value: "moderate", emoji: "⚡", label: "Moderate" },
  { value: "chatty", emoji: "💬", label: "Chatty" },
];
const neighborhoods = ["HSR Layout", "Koramangala", "Indiranagar", "BTM Layout", "JP Nagar", "Jayanagar", "Whitefield", "Electronic City", "Marathahalli", "Sarjapur Road", "Other"];
const lookingSuggestions = ["co-founder", "accountability buddy", "clients", "friends", "mentorship", "design feedback", "tech help", "investment", "workout buddy", "coffee chats", "hiring", "networking"];
const offerSuggestions = ["design help", "code reviews", "intro to investors", "marketing advice", "content writing", "career advice", "hiring help", "startup advice", "photography", "fitness tips", "legal advice", "fundraising help"];
const interestSuggestions = ["startups", "design", "coding", "fitness", "reading", "gaming", "music", "photography", "travel", "food", "investing", "AI/ML", "crypto", "writing", "yoga", "running", "meditation", "cooking", "parenting", "books"];

const VIBE_LABELS: Record<string, string> = { deep_focus: "🎯 Deep Focus", casual_social: "☕ Casual Social", balanced: "⚖️ Balanced" };
const PROP_EMOJIS: Record<string, string> = { energy: "⚡", helpful: "🤝", focused: "🎯", inspiring: "💡", fun: "🎉", kind: "💛" };

interface EarnedBadge { badge_type: string; earned_at: string | null; }

/* DESIGN: Autopilot settings — only shown after 3+ sessions.
   Must prove the habit before automating it. */
function AutopilotSettingsCard({ profile, userId }: { profile: any; userId: string }) {
  const [enabled, setEnabled] = useState(profile.autopilot_enabled || false);
  const [days, setDays] = useState<string[]>(profile.autopilot_days || []);
  const [times, setTimes] = useState<string[]>(profile.autopilot_times || []);
  const [maxPerWeek, setMaxPerWeek] = useState(profile.autopilot_max_per_week || 2);
  const [preferCircle, setPreferCircle] = useState(profile.autopilot_prefer_circle ?? true);

  const save = async (updates: Record<string, any>) => {
    await supabase.from("profiles").update(updates).eq("id", userId);
  };

  const DAY_CHIPS = [
    { id: "monday", label: "Mon" }, { id: "tuesday", label: "Tue" }, { id: "wednesday", label: "Wed" },
    { id: "thursday", label: "Thu" }, { id: "friday", label: "Fri" }, { id: "saturday", label: "Sat" }, { id: "sunday", label: "Sun" },
  ];
  const TIME_CHIPS = [
    { id: "morning", label: "🌅 Morning (8-12)" },
    { id: "afternoon", label: "☀️ Afternoon (12-5)" },
    { id: "evening", label: "🌙 Evening (5-9)" },
  ];

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-foreground flex items-center gap-1.5">⚡ Session Autopilot</h3>
            <p className="text-xs text-muted-foreground">We'll auto-book matching sessions for you</p>
          </div>
          <Switch checked={enabled} onCheckedChange={(v) => { setEnabled(v); save({ autopilot_enabled: v }); }} />
        </div>
        {enabled && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-foreground">Days</label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {DAY_CHIPS.map(d => (
                  <button key={d.id} onClick={() => {
                    const next = days.includes(d.id) ? days.filter(x => x !== d.id) : [...days, d.id];
                    setDays(next); save({ autopilot_days: next });
                  }} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${days.includes(d.id) ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-muted"}`}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">Times</label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {TIME_CHIPS.map(t => (
                  <button key={t.id} onClick={() => {
                    const next = times.includes(t.id) ? times.filter(x => x !== t.id) : [...times, t.id];
                    setTimes(next); save({ autopilot_times: next });
                  }} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${times.includes(t.id) ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-muted"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">Max sessions per week</label>
              <div className="flex gap-2 mt-1.5">
                {[1, 2, 3].map(n => (
                  <button key={n} onClick={() => { setMaxPerWeek(n); save({ autopilot_max_per_week: n }); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${maxPerWeek === n ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted"}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground">Prioritize sessions with your Circle</span>
              <Switch checked={preferCircle} onCheckedChange={(v) => { setPreferCircle(v); save({ autopilot_prefer_circle: v }); }} />
            </div>
            <p className="text-[10px] text-muted-foreground">You can always cancel individual bookings. We'll notify you 48h before each auto-booking.</p>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Theme Section ──────────────────────────────────────
function ThemeSection() {
  const { theme, setTheme } = useTheme();
  const options = [
    { value: "light" as const, icon: Sun, label: "Light" },
    { value: "dark" as const, icon: Moon, label: "Dark" },
    { value: "system" as const, icon: Monitor, label: "System" },
  ];
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-foreground">Theme</h3>
      <div className="grid grid-cols-3 gap-2">
        {options.map(o => (
          <button key={o.value} onClick={() => setTheme(o.value)}
            className={`rounded-xl border p-3 text-center transition-all ${theme === o.value ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}>
            <o.icon className="w-5 h-5 mx-auto text-foreground" />
            <p className="text-xs font-medium text-foreground mt-1">{o.label}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Invite Section ──────────────────────────────────────
function InviteSection({ userId, referralCode }: { userId?: string; referralCode?: string | null }) {
  const [referralCount, setReferralCount] = useState(0);
  const [referrals, setReferrals] = useState<Array<{ id: string; display_name: string | null; avatar_url: string | null }>>([]);
  const appUrl = window.location.origin;
  const code = referralCode || userId?.replace(/-/g, "").slice(0, 8) || "";
  const inviteLink = `${appUrl}/invite/${code}`;

  useEffect(() => {
    if (!userId) return;
    supabase.from("profiles").select("id, display_name, avatar_url", { count: "exact" })
      .eq("referred_by", userId)
      .then(({ count, data }) => { setReferralCount(count || 0); setReferrals(data || []); });
  }, [userId]);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-foreground">Your Invites</h3>
      {referralCount > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-foreground font-medium">{referralCount} {referralCount === 1 ? "person" : "people"} joined through your link 🎉</p>
          <div className="flex -space-x-2">
            {referrals.slice(0, 8).map(r => (
              <Avatar key={r.id} className="w-8 h-8 border-2 border-background">
                <AvatarImage src={r.avatar_url || ""} />
                <AvatarFallback className="text-[10px] bg-muted">{getInitials(r.display_name)}</AvatarFallback>
              </Avatar>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <Input value={inviteLink} readOnly className="text-xs flex-1" />
        <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(inviteLink); sonnerToast.success("Link copied!"); }}>Copy</Button>
      </div>
      <WhatsAppShareButton message={`Hey! I'm on FocusClub — a community for people who cowork in Bangalore. Join me: ${inviteLink}`} label="Share on WhatsApp" fullWidth />
    </div>
  );
}

// ─── Share Card Section ──────────────────────────────────
function ShareCardSection({ profile, referralCode }: { profile: any; referralCode?: string | null }) {
  const [propCounts, setPropCounts] = useState<Record<string, number>>({});
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const profileLink = `${appUrl}/profile/${profile.id}${referralCode ? `?ref=${referralCode}` : ""}`;

  useEffect(() => {
    supabase.from("peer_props").select("prop_type").eq("to_user", profile.id)
      .then(({ data }: any) => {
        if (!data) return;
        const counts: Record<string, number> = {};
        data.forEach((r: any) => { counts[r.prop_type] = (counts[r.prop_type] || 0) + 1; });
        setPropCounts(counts);
      });
  }, [profile.id]);

  const { handleShare, handleWhatsApp, handleCopy, handleDownload, generating } = ShareProfileCard({
    profile, propCounts, streak: profile.current_streak || 0, referralCode,
  });

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-foreground">Share Your Card</h3>
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" onClick={handleShare} disabled={generating} className="gap-2">
          <Share2 className="w-3.5 h-3.5" /> {generating ? "..." : "Share"}
        </Button>
        <Button size="sm" variant="default" onClick={handleWhatsApp} disabled={generating} className="gap-2 bg-[#25D366] hover:bg-[#20BD5A]">
          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
        </Button>
        <CopyLinkButton link={profileLink} label="Copy Link" size="sm" />
        <Button size="sm" variant="outline" onClick={handleDownload} disabled={generating} className="gap-2">
          <Download className="w-3.5 h-3.5" /> Download
        </Button>
      </div>
    </div>
  );
}

// ─── Profile Views Section ──────────────────────────────
function ProfileViewsSection({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const { hasFeature } = useSubscription();
  const [viewCount, setViewCount] = useState(0);
  const [viewers, setViewers] = useState<Array<{ viewer_id: string; viewed_at: string; display_name: string | null; avatar_url: string | null }>>([]);

  useEffect(() => {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fetchViews = async () => {
      const { count } = await supabase
        .from("profile_views")
        .select("id", { count: "exact", head: true })
        .eq("viewed_id", userId)
        .gte("viewed_at", oneWeekAgo);
      setViewCount(count || 0);

      if (hasFeature("profile_views_names")) {
        const { data } = await supabase
          .from("profile_views")
          .select("viewer_id, viewed_at, profiles:viewer_id(display_name, avatar_url)")
          .eq("viewed_id", userId)
          .gte("viewed_at", oneWeekAgo)
          .order("viewed_at", { ascending: false })
          .limit(10);
        setViewers((data || []).map((d: any) => ({
          viewer_id: d.viewer_id,
          viewed_at: d.viewed_at,
          display_name: d.profiles?.display_name,
          avatar_url: d.profiles?.avatar_url,
        })));
      }
    };
    fetchViews();
  }, [userId, hasFeature]);

  if (viewCount === 0) return null;

  const canSeeNames = hasFeature("profile_views_names");

  return (
    <Card className="border-border/50 cursor-pointer" onClick={() => !canSeeNames && navigate("/pricing")}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">{viewCount} {viewCount === 1 ? "person" : "people"} viewed your profile this week</p>
        </div>
        {canSeeNames ? (
          <div className="space-y-2">
            {viewers.map((v) => (
              <div key={v.viewer_id} className="flex items-center gap-2">
                <Avatar className="w-6 h-6">
                  <AvatarImage src={v.avatar_url || ""} />
                  <AvatarFallback className="text-[8px]">{getInitials(v.display_name)}</AvatarFallback>
                </Avatar>
                <span className="text-xs text-foreground">{v.display_name || "Someone"}</span>
                <span className="text-[10px] text-muted-foreground">· {format(new Date(v.viewed_at), "MMM d")}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-7 h-7 rounded-full bg-muted blur-[2px] border-2 border-background" />
              ))}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="w-3 h-3" />
              <span>Upgrade to Plus to see who's viewing you</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Profile Page ──────────────────────────────────
export default function Profile() {
  usePageTitle("You — FocusClub");
  const { profile, user, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
  const [propCounts, setPropCounts] = useState<Record<string, number>>({});
  const [achievements, setAchievements] = useState<Array<{ achievement_type: string; achieved_at: string }>>([]);
  const [monthlyTitles, setMonthlyTitles] = useState<Array<{ title_type: string; month: string }>>([]);
  const [scrapbookEntries, setScrapbookEntries] = useState<ScrapbookEntry[]>([]);
  const [journeyFilter, setJourneyFilter] = useState<"all" | "sessions" | "badges" | "achievements">("all");

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [tagline, setTagline] = useState("");
  const [whatIDo, setWhatIDo] = useState("");
  const [workVibe, setWorkVibe] = useState("");
  const [gender, setGender] = useState("");
  const [womenOnly, setWomenOnly] = useState(false);
  const [noisePref, setNoisePref] = useState("");
  const [commStyle, setCommStyle] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  const [canOffer, setCanOffer] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [linkedin, setLinkedin] = useState("");
  const [instagram, setInstagram] = useState("");
  const [twitter, setTwitter] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [showLinkedin, setShowLinkedin] = useState(true);
  const [showInstagram, setShowInstagram] = useState(true);
  const [showTwitter, setShowTwitter] = useState(true);
  const [prefLat, setPrefLat] = useState<number | null>(null);
  const [prefLng, setPrefLng] = useState<number | null>(null);
  const [prefRadius, setPrefRadius] = useState(5);
  const [prefNeighborhoods, setPrefNeighborhoods] = useState<string[]>([]);
  const [prefDays, setPrefDays] = useState<string[]>([]);
  const [prefTimes, setPrefTimes] = useState<string[]>([]);
  const [prefDuration, setPrefDuration] = useState(2);

  // Load profile data
  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? "");
    setTagline(profile.tagline ?? "");
    setWhatIDo(profile.what_i_do ?? "");
    setWorkVibe(profile.work_vibe ?? "");
    setGender(profile.gender ?? "");
    setWomenOnly(profile.women_only_interest ?? false);
    setNoisePref(profile.noise_preference ?? "");
    setCommStyle(profile.communication_style ?? "");
    setNeighborhood(profile.neighborhood ?? "");
    setLookingFor(profile.looking_for ?? []);
    setCanOffer(profile.can_offer ?? []);
    setInterests(profile.interests ?? []);
    setLinkedin(profile.linkedin_url ?? "");
    setInstagram(profile.instagram_handle ?? "");
    setTwitter(profile.twitter_handle ?? "");
    setPhone(profile.phone ?? "");
    setAvatarUrl(profile.avatar_url ?? "");
    setShowLinkedin(profile.show_linkedin ?? true);
    setShowInstagram(profile.show_instagram ?? true);
    setShowTwitter(profile.show_twitter ?? true);
    setPrefLat(profile.preferred_latitude ?? null);
    setPrefLng(profile.preferred_longitude ?? null);
    setPrefRadius(profile.preferred_radius_km ?? 5);
    setPrefNeighborhoods(profile.preferred_neighborhoods ?? []);
    setPrefDays(profile.preferred_days ?? []);
    setPrefTimes(profile.preferred_times ?? []);
    setPrefDuration(profile.preferred_session_duration ?? 2);
  }, [profile]);

  // Load gamification data
  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("member_badges").select("badge_type, earned_at").eq("user_id", user.id),
      supabase.from("peer_props").select("prop_type").eq("to_user", user.id),
      supabase.from("exclusive_achievements").select("achievement_type, achieved_at").eq("user_id", user.id),
      supabase.from("monthly_titles").select("title_type, month").eq("user_id", user.id),
      supabase.from("session_scrapbook").select("*").eq("user_id", user.id).order("session_date", { ascending: false }),
    ]).then(([badges, props, achiev, titles, scrapbook]) => {
      setEarnedBadges(badges.data || []);
      const counts: Record<string, number> = {};
      (props.data || []).forEach((p: any) => { counts[p.prop_type] = (counts[p.prop_type] || 0) + 1; });
      setPropCounts(counts);
      setAchievements(achiev.data || []);
      setMonthlyTitles(titles.data || []);
      setScrapbookEntries(scrapbook.data || []);
    });
  }, [user]);

  const completion = useMemo(() => calculateProfileCompletion({
    ...profile!,
    display_name: displayName, tagline, what_i_do: whatIDo, work_vibe: workVibe,
    looking_for: lookingFor, can_offer: canOffer, interests,
    linkedin_url: linkedin, instagram_handle: instagram, twitter_handle: twitter,
    gender, neighborhood, avatar_url: avatarUrl,
  }), [displayName, tagline, whatIDo, workVibe, lookingFor, canOffer, interests, linkedin, instagram, twitter, gender, neighborhood, avatarUrl, profile]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(`${data.publicUrl}?t=${Date.now()}`);
  };

  const handleSave = async () => {
    if (!user || !profile) return;
    setSaving(true);
    const profileData: Record<string, any> = {
      display_name: displayName, tagline, what_i_do: whatIDo, work_vibe: workVibe,
      gender: gender.toLowerCase(), women_only_interest: womenOnly,
      noise_preference: noisePref, communication_style: commStyle,
      neighborhood, looking_for: lookingFor, can_offer: canOffer, interests,
      linkedin_url: linkedin, instagram_handle: instagram, twitter_handle: twitter,
      phone, avatar_url: avatarUrl, profile_completion: completion,
      show_linkedin: showLinkedin, show_instagram: showInstagram, show_twitter: showTwitter,
      preferred_latitude: prefLat, preferred_longitude: prefLng, preferred_radius_km: prefRadius,
      preferred_neighborhoods: prefNeighborhoods, preferred_days: prefDays, preferred_times: prefTimes,
      preferred_session_duration: prefDuration,
    };
    const { error } = await supabase.from("profiles").update(profileData).eq("id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: ERROR_STATES.generic, variant: "destructive" });
    } else {
      toast({ title: CONFIRMATIONS.profileSaved });
      await refreshProfile();
      if (!profile.referral_code) {
        await supabase.from("profiles").update({ referral_code: user.id.replace(/-/g, "").slice(0, 8) }).eq("id", user.id);
      }
      const updatedProfile = { ...profile, ...profileData };
      const newBadges = await checkAndAwardBadges(user.id, updatedProfile);
      if (newBadges.length > 0) {
        newBadges.forEach(bt => {
          const def = getBadgeDef(bt);
          if (def) sonnerToast.success(`🎉 Badge earned: ${def.emoji} ${def.name}!`);
        });
        const { data } = await supabase.from("member_badges").select("badge_type, earned_at").eq("user_id", user.id);
        setEarnedBadges(data || []);
      }
    }
  };

  const handleSignOut = async () => { await signOut(); navigate("/"); };

  const focusHours = Number(profile?.focus_hours ?? 0);
  const rank = getRankForHours(focusHours);
  const nextRank = getNextRank(focusHours);
  const rankProgress = getRankProgress(focusHours);
  const totalProps = Object.values(propCounts).reduce((a, b) => a + b, 0);

  if (!profile) return (
    <AppShell><div className="px-4 py-6 space-y-4 max-w-lg mx-auto">
      {Array.from({ length: 4 }).map((_, i) => <UISkeleton key={i} className="h-32 rounded-lg" />)}
    </div></AppShell>
  );

  // Journey items — merged chronological timeline including scrapbook
  const journeyItems = [
    ...scrapbookEntries.map(s => ({
      type: "session" as const, emoji: "📔",
      name: s.highlight || `Session at ${s.venue_name || "unknown"}`,
      date: s.session_date || s.created_at || "",
      scrapbook: s,
    })),
    ...earnedBadges.map(b => ({
      type: "badge" as const, emoji: getBadgeDef(b.badge_type)?.emoji || "🏅",
      name: getBadgeDef(b.badge_type)?.name || b.badge_type, date: b.earned_at || "",
      scrapbook: null as ScrapbookEntry | null,
    })),
    ...achievements.map(a => ({
      type: "achievement" as const, emoji: getAchievementDef(a.achievement_type)?.emoji || "🏆",
      name: a.achievement_type.replace(/_/g, " "), date: a.achieved_at || "",
      scrapbook: null as ScrapbookEntry | null,
    })),
    ...monthlyTitles.map(t => ({
      type: "title" as const, emoji: MONTHLY_TITLE_DEFS[t.title_type]?.emoji || "👑",
      name: t.title_type.replace(/_/g, " "), date: t.month || "",
      scrapbook: null as ScrapbookEntry | null,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredJourney = journeyFilter === "all" ? journeyItems
    : journeyFilter === "sessions" ? journeyItems.filter(i => i.type === "session")
    : journeyFilter === "badges" ? journeyItems.filter(i => i.type === "badge")
    : journeyItems.filter(i => i.type === "achievement" || i.type === "title");

  return (
    <AppShell>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
        className="max-w-lg mx-auto pb-28">
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="w-full sticky top-0 z-10 bg-background/80 backdrop-blur-sm rounded-none border-b border-border">
            <TabsTrigger value="profile" className="flex-1">Profile</TabsTrigger>
            <TabsTrigger value="journey" className="flex-1">Journey</TabsTrigger>
            <TabsTrigger value="settings" className="flex-1">Settings</TabsTrigger>
          </TabsList>

          {/* Settings gear link */}
          <div className="flex justify-end px-4 pt-2">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground" onClick={() => navigate("/settings")}>
              <Settings className="w-3.5 h-3.5" /> App Settings
            </Button>
          </div>

          {/* ═══ PROFILE TAB ═══ */}
          <TabsContent value="profile" className="px-4 pt-4 space-y-5">
            {/* Avatar + Rank */}
            <div className="flex flex-col items-center gap-3">
              <RankAvatar avatarUrl={avatarUrl || undefined} displayName={displayName} focusHours={focusHours} size="xl" />
              <div className="text-center">
                <h2 className="font-serif text-xl text-foreground">{displayName}</h2>
                {tagline && <p className="text-sm text-muted-foreground">{tagline}</p>}
              </div>
              {workVibe && <Badge variant="secondary" className="rounded-full">{VIBE_LABELS[workVibe] || workVibe}</Badge>}
              {profile.is_table_captain && <CaptainBadge />}
            </div>

            {/* Looking for / Can offer */}
            {lookingFor.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Looking for</p>
                <div className="flex flex-wrap gap-1.5">
                  {lookingFor.map(tag => (
                    <span key={tag} className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/15 text-primary">{tag}</span>
                  ))}
                </div>
              </div>
            )}
            {canOffer.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Can offer</p>
                <div className="flex flex-wrap gap-1.5">
                  {canOffer.map(tag => (
                    <span key={tag} className="px-2.5 py-1 rounded-full text-xs font-medium bg-secondary/15 text-secondary">{tag}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Compact stats row */}
            <div className="flex items-center justify-around py-3 rounded-xl bg-muted/50">
              <div className="text-center">
                <p className="text-lg font-bold text-foreground">{focusHours}</p>
                <p className="text-[10px] text-muted-foreground">Focus Hours</p>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="text-center">
                <p className="text-lg font-bold text-foreground">{profile.events_attended || 0}</p>
                <p className="text-[10px] text-muted-foreground">Sessions</p>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="text-center">
                <p className="text-lg font-bold text-foreground">{profile.current_streak || 0}</p>
                <p className="text-[10px] text-muted-foreground">Streak 🔥</p>
              </div>
            </div>

            {/* Props summary */}
            {totalProps > 0 && (
              <div className="flex items-center gap-3 text-sm">
                {Object.entries(propCounts).map(([type, count]) => (
                  <span key={type} className="text-foreground">{PROP_EMOJIS[type] || "💫"} {count}</span>
                ))}
              </div>
            )}

            {/* Earned badges — only if any */}
            {earnedBadges.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Badges ({earnedBadges.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {earnedBadges.map(b => {
                    const def = getBadgeDef(b.badge_type);
                    return def ? (
                      <span key={b.badge_type} className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                        {def.emoji} {def.name}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            {/* Profile Views */}
            <ProfileViewsSection userId={user!.id} />

            {/* Share Card */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-4">
                <ShareCardSection profile={{ ...profile, display_name: displayName, tagline, avatar_url: avatarUrl, looking_for: lookingFor, can_offer: canOffer, work_vibe: workVibe }} referralCode={profile.referral_code} />
              </CardContent>
            </Card>

            {/* Next rank */}
            {nextRank && (
              <p className="text-xs text-muted-foreground text-center">
                Next: {nextRank.emoji} {nextRank.name} — {rankProgress.hoursToNext}h to go
              </p>
            )}
          </TabsContent>

          <TabsContent value="journey" className="px-4 pt-4 space-y-5">
            <p className="text-xs text-muted-foreground">
              Your Journey — {profile.events_attended || 0} sessions and counting
            </p>

            {/* Filter chips */}
            <div className="flex gap-2 flex-wrap">
              {(["all", "sessions", "badges", "achievements"] as const).map(f => (
                <button key={f} onClick={() => setJourneyFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${journeyFilter === f ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-muted"}`}>
                  {f === "all" ? "All" : f === "sessions" ? "📔 Sessions" : f === "badges" ? "🏅 Badges" : "🏆 Achievements"}
                </button>
              ))}
            </div>

            {filteredJourney.length > 0 ? (
              <div className="space-y-3">
                {filteredJourney.map((item, i) => (
                  item.type === "session" && item.scrapbook ? (
                    <ScrapbookCard key={`session-${i}`} entry={item.scrapbook} compact />
                  ) : (
                    <div key={`${item.type}-${i}`} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                      <span className="text-lg">{item.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground capitalize">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground">{item.type}</p>
                      </div>
                      {item.date && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {(() => { try { return format(new Date(item.date), "MMM d, yyyy"); } catch { return item.date; } })()}
                        </span>
                      )}
                    </div>
                  )
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <p className="font-serif text-lg mb-1">Your journey starts with your first session.</p>
                  <p className="text-sm">RSVP to a session and start building your story.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/events")}>Browse Sessions</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ═══ SETTINGS TAB ═══ */}
          <TabsContent value="settings" className="px-4 pt-4 space-y-4">
            {/* Personal Info */}
            <Card>
              <CardContent className="pt-4 space-y-4">
                <h3 className="font-serif text-base text-foreground">Personal Info</h3>
                <div className="flex justify-center">
                  <label className="cursor-pointer block relative">
                    <RankAvatar avatarUrl={avatarUrl || undefined} displayName={displayName} focusHours={focusHours} size="lg" />
                    <span className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-1.5">
                      <Camera className="w-3.5 h-3.5" />
                    </span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                  </label>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Display Name *</label>
                  <Input value={displayName} onChange={e => setDisplayName(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Tagline</label>
                  <Input value={tagline} onChange={e => setTagline(e.target.value.slice(0, 140))} className="mt-1" placeholder="Designer by day, guitarist by night" />
                  <p className="text-xs text-muted-foreground text-right mt-0.5">{tagline.length}/140</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">What I Do</label>
                  <Textarea value={whatIDo} onChange={e => setWhatIDo(e.target.value.slice(0, 500))} className="mt-1" rows={3} />
                </div>
              </CardContent>
            </Card>

            {/* Work Preferences */}
            <Card>
              <CardContent className="pt-4 space-y-4">
                <h3 className="font-serif text-base text-foreground">Work Preferences</h3>
                <div>
                  <label className="text-sm font-medium text-foreground">Work Vibe</label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {vibeOptions.map(v => (
                      <button key={v.value} onClick={() => setWorkVibe(v.value)}
                        className={`rounded-xl border p-3 text-center transition-all ${workVibe === v.value ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}>
                        <span className="text-xl">{v.emoji}</span>
                        <p className="text-xs font-medium text-foreground mt-1">{v.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Gender</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {genderOptions.map(g => (
                      <button key={g.value} onClick={() => setGender(g.value)}
                        className={`px-3 py-1.5 rounded-full text-xs border transition-all ${gender === g.value ? "bg-primary text-primary-foreground border-primary" : "border-border text-foreground hover:bg-muted"}`}>
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
                {gender === "woman" && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">Women-only meetups</span>
                    <Switch checked={womenOnly} onCheckedChange={setWomenOnly} />
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-foreground">Noise Preference</label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {noiseOptions.map(n => (
                      <button key={n.value} onClick={() => setNoisePref(n.value)}
                        className={`rounded-xl border p-3 text-center transition-all ${noisePref === n.value ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}>
                        <span className="text-xl">{n.emoji}</span>
                        <p className="text-xs font-medium text-foreground mt-1">{n.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Communication Style</label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {commOptions.map(c => (
                      <button key={c.value} onClick={() => setCommStyle(c.value)}
                        className={`rounded-xl border p-3 text-center transition-all ${commStyle === c.value ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}>
                        <span className="text-xl">{c.emoji}</span>
                        <p className="text-xs font-medium text-foreground mt-1">{c.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Neighborhood</label>
                  <Select value={neighborhood} onValueChange={setNeighborhood}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select neighborhood" /></SelectTrigger>
                    <SelectContent>{neighborhoods.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Exchange */}
            <Card>
              <CardContent className="pt-4 space-y-5">
                <h3 className="font-serif text-base text-foreground">Exchange</h3>
                <TagInput label="Looking For" tags={lookingFor} onChange={setLookingFor} suggestions={lookingSuggestions} variant="primary" placeholder="Type + Enter" />
                <TagInput label="Can Offer" tags={canOffer} onChange={setCanOffer} suggestions={offerSuggestions} variant="secondary" placeholder="Type + Enter" />
              </CardContent>
            </Card>

            {/* Location Preferences */}
            <Card>
              <CardContent className="pt-4 space-y-4">
                <h3 className="font-serif text-base text-foreground">Location Preferences</h3>
                <Suspense fallback={<UISkeleton className="h-[200px] rounded-xl" />}>
                  <LocationPicker
                    latitude={prefLat} longitude={prefLng} radiusKm={prefRadius}
                    onLocationChange={(lat, lng) => { setPrefLat(lat); setPrefLng(lng); }}
                    onRadiusChange={r => setPrefRadius(r)}
                  />
                </Suspense>
                <div>
                  <label className="text-sm font-medium text-foreground">Preferred Neighborhoods</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {["HSR Layout", "Koramangala", "Indiranagar", "Jayanagar", "Whitefield", "Electronic City"].map(n => (
                      <label key={n} className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
                        <Checkbox checked={prefNeighborhoods.includes(n)} onCheckedChange={checked => setPrefNeighborhoods(prev => checked ? [...prev, n] : prev.filter(x => x !== n))} />
                        {n}
                      </label>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Session Preferences */}
            <Card>
              <CardContent className="pt-4 space-y-4">
                <h3 className="font-serif text-base text-foreground">Session Preferences</h3>
                <div>
                  <label className="text-sm font-medium text-foreground">Preferred Days</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {[{ id: "monday", label: "Mon" }, { id: "tuesday", label: "Tue" }, { id: "wednesday", label: "Wed" }, { id: "thursday", label: "Thu" }, { id: "friday", label: "Fri" }, { id: "saturday", label: "Sat" }, { id: "sunday", label: "Sun" }].map(d => (
                      <button key={d.id} onClick={() => setPrefDays(prev => prev.includes(d.id) ? prev.filter(x => x !== d.id) : [...prev, d.id])}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${prefDays.includes(d.id) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/40"}`}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Preferred Time</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {[{ id: "morning", label: "🌅 Morning (8-12)" }, { id: "afternoon", label: "☀️ Afternoon (12-5)" }, { id: "evening", label: "🌙 Evening (5-9)" }].map(t => (
                      <button key={t.id} onClick={() => setPrefTimes(prev => prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id])}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${prefTimes.includes(t.id) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/40"}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Ideal Session Length</label>
                  <div className="flex gap-3 mt-2">
                    {[2, 4].map(h => (
                      <button key={h} onClick={() => setPrefDuration(h)}
                        className={`flex-1 py-3 rounded-xl border-2 text-sm font-medium transition-all ${prefDuration === h ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-foreground hover:border-primary/40"}`}>
                        {h} hours
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Interests */}
            <Card>
              <CardContent className="pt-4 space-y-4">
                <h3 className="font-serif text-base text-foreground">Interests</h3>
                <TagInput label="" tags={interests} onChange={setInterests} suggestions={interestSuggestions} variant="primary" placeholder="Type + Enter" />
              </CardContent>
            </Card>

            {/* Socials */}
            <Card>
              <CardContent className="pt-4 space-y-3">
                <h3 className="font-serif text-base text-foreground">Socials & Contact</h3>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-muted-foreground">LinkedIn</label>
                    <div className="flex items-center gap-1.5"><span className="text-[10px] text-muted-foreground">Show</span><Switch checked={showLinkedin} onCheckedChange={setShowLinkedin} className="scale-75" /></div>
                  </div>
                  <Input value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="linkedin.com/in/..." className="mt-1" />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-muted-foreground">Instagram</label>
                    <div className="flex items-center gap-1.5"><span className="text-[10px] text-muted-foreground">Show</span><Switch checked={showInstagram} onCheckedChange={setShowInstagram} className="scale-75" /></div>
                  </div>
                  <div className="relative mt-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span><Input value={instagram} onChange={e => setInstagram(e.target.value)} className="pl-7" /></div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-muted-foreground">Twitter / X</label>
                    <div className="flex items-center gap-1.5"><span className="text-[10px] text-muted-foreground">Show</span><Switch checked={showTwitter} onCheckedChange={setShowTwitter} className="scale-75" /></div>
                  </div>
                  <div className="relative mt-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span><Input value={twitter} onChange={e => setTwitter(e.target.value)} className="pl-7" /></div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Phone / WhatsApp</label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="For WhatsApp only" className="mt-1" />
                  <div className="flex items-start gap-1.5 mt-1">
                    <Lock className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-[10px] text-muted-foreground">Never shown on your profile.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* DESIGN: Autopilot gated to 3+ sessions — must prove the habit before automating it */}
            {(profile.events_attended || 0) >= 3 && (
              <AutopilotSettingsCard profile={profile} userId={user?.id || ""} />
            )}

            {/* Captain */}
            <CaptainOptInCard />

            {/* Welcome Buddy */}
            {(profile.events_attended || 0) >= 3 && (
              <Card>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-foreground">Welcome Buddy</h3>
                      <p className="text-xs text-muted-foreground">Say hi to first-timers at your sessions</p>
                    </div>
                    <Switch
                      checked={profile.is_welcome_buddy || false}
                      onCheckedChange={async (checked) => {
                        await supabase.from("profiles").update({ is_welcome_buddy: checked }).eq("id", user!.id);
                        sonnerToast.success(checked ? "You're a Welcome Buddy now! 💛" : "Buddy mode off");
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Invite */}
            <Card><CardContent className="pt-4"><InviteSection userId={user?.id} referralCode={profile?.referral_code} /></CardContent></Card>

            {/* Theme */}
            <Card><CardContent className="pt-4"><ThemeSection /></CardContent></Card>

            {/* Sign out */}
            <div className="text-center pt-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="text-sm text-destructive hover:underline inline-flex items-center gap-1"><LogOut className="w-3.5 h-3.5" /> Sign Out</button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Sign out?</AlertDialogTitle>
                    <AlertDialogDescription>You'll need to sign in again to access FocusClub.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Never mind</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSignOut}>Sign Out</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </TabsContent>
        </Tabs>

        {/* Sticky save — only on Settings tab */}
        <div className="fixed bottom-16 left-0 right-0 px-4 pb-3 pt-2 bg-gradient-to-t from-background via-background to-transparent">
          <div className="max-w-lg mx-auto">
            <Button className="w-full" onClick={handleSave} disabled={saving || !displayName}>
              {saving ? "Saving..." : "Lock it in"}
            </Button>
          </div>
        </div>
      </motion.div>
    </AppShell>
  );
}
