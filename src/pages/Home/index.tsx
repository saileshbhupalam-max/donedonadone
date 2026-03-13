import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { calculateProfileCompletion } from "@/lib/matchUtils";
import { getInitials } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { PersonalityLoader } from "@/components/ui/PersonalityLoader";
import { ArrowRight, CalendarIcon, MapPin, Users, MessageSquare, Sparkles, CheckCircle2, Navigation, Dna, Bell, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { AddToCalendarButton } from "@/components/session/AddToCalendarButton";
import { sessionMatchScore } from "@/lib/sessionMatch";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { format, parseISO, subDays, isMonday, isFriday, startOfWeek, endOfWeek, startOfMonth, subMonths } from "date-fns";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { usePageTitle } from "@/hooks/usePageTitle";
import { getRankForHours, calculateSessionHours, addFocusHours } from "@/lib/ranks";
import { RankAvatar } from "@/components/gamification/RankAvatar";
import { RankBadge } from "@/components/gamification/RankBadge";
import { LeaderboardHomeCard } from "@/components/gamification/LeaderboardSection";
import { GivePropsFlow } from "@/components/session/GivePropsFlow";
import { PostEventShareCard } from "@/components/sharing/PostEventShare";
import { WhatsAppShareButton } from "@/components/sharing/WhatsAppButton";
import { getPromptInviteMessage } from "@/lib/sharing";
import { checkMilestones, checkReEngagement, trackAnalyticsEvent, MilestoneDef } from "@/lib/growth";
import { MilestoneCelebration } from "@/components/growth/MilestoneCelebration";
import { CommunityHighlight, EnhancedWeeklyDigest } from "@/components/growth/GrowthCards";
import { CreditsBadge } from "@/components/growth/CreditsBadge";
import { GrowthNudgeCard } from "@/components/growth/GrowthNudgeCard";
import { ContributionMilestoneCard } from "@/components/growth/ContributionMilestoneCard";
import { useFocusCredits } from "@/hooks/useFocusCredits";
import { getContextualGreeting, EMPTY_STATES, ERROR_STATES, getLoadingMessage, CONFIRMATIONS } from "@/lib/personality";
import { usePersonality } from "@/contexts/PersonalityContext";
import { motion } from "framer-motion";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { PrimaryActionCard } from "@/components/home/PrimaryActionCard";
import { ProfilePromptCard } from "@/components/home/ProfilePromptCard";
import { GratitudeEchoCard } from "@/components/home/GratitudeEchoCard";
import { CommunityRitualCard } from "@/components/home/CommunityRitualCard";
import { CaptainDashboardCard } from "@/components/home/CaptainDashboardCard";
import { Users as UsersIcon, Zap, Shield } from "lucide-react";
import { ActiveCheckInCard, CheckInFlow } from "@/components/checkin/CheckInFlow";
import { useUserContext } from "@/hooks/useUserContext";
import { FeatureGate } from "@/components/FeatureGate";
import { WhosHere } from "@/components/community/WhosHere";
import { CompaniesHere } from "@/components/community/CompaniesHere";
import { MatchSuggestions } from "@/components/community/MatchSuggestions";
import { DnaCompletionNudge } from "@/components/home/DnaCompletionNudge";
import { MicroRequestBoard } from "@/components/community/MicroRequestBoard";
import { CoffeeRoulette } from "@/components/community/CoffeeRoulette";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Hand, Coffee as CoffeeIcon } from "lucide-react";
import { StreakCard } from "@/components/streaks/StreakCard";
import { ActivitySummary } from "@/components/streaks/ActivitySummary";
import { UpgradeSessionPrompt } from "@/components/upgrade/UpgradeSessionPrompt";
import { BoostMathBanner } from "@/components/upgrade/BoostMathBanner";
import { WeeklyDigest } from "@/components/dashboard/WeeklyDigest";
import { MatchNudgeCard } from "@/components/home/MatchNudgeCard";

import type { Profile, ActivePrompt, NextMeetup, PendingFeedback, CommunityStats, PostSessionSummary, WeeklyDigestData } from "./types";
import { getFirstName, getNextAction } from "./helpers";
import { StreakIndicator } from "./StreakIndicator";
import { PushOptInCard } from "./PushOptInCard";

export default function Home() {
  const personality = usePersonality();
  usePageTitle("Home — FocusClub");
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { currentState, dnaComplete, refreshCheckIn } = useUserContext();
  const { balance: fcBalance, refresh: refreshCredits } = useFocusCredits();
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [microRequestsOpen, setMicroRequestsOpen] = useState(false);
  const [coffeeRouletteOpen, setCoffeeRouletteOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [upcomingEvent, setUpcomingEvent] = useState<{ id: string; title: string; goingCount: number } | null>(null);
  const [activePrompt, setActivePrompt] = useState<ActivePrompt | null>(null);
  const [nextMeetup, setNextMeetup] = useState<NextMeetup | null>(null);
  const [newMembers, setNewMembers] = useState<Profile[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [stats, setStats] = useState<CommunityStats>({ totalMembers: 0, promptAnswersThisWeek: 0, upcomingEvents: 0 });
  const [pendingFeedback, setPendingFeedback] = useState<PendingFeedback[]>([]);
  const [showPropsForEvent, setShowPropsForEvent] = useState<string | null>(null);
  const [postSessionSummary, setPostSessionSummary] = useState<PostSessionSummary | null>(null);
  const [weeklyDigest, setWeeklyDigest] = useState<WeeklyDigestData | null>(null);
  const [celebrateMilestone, setCelebrateMilestone] = useState<MilestoneDef | null>(null);
  const [enhancedDigest, setEnhancedDigest] = useState<any>(null);
  const [nearbySessions, setNearbySessions] = useState<any[]>([]);
  const [scoredSessions, setScoredSessions] = useState<any[]>([]);
  const [discoverySessions, setDiscoverySessions] = useState<any[]>([]);
  const [circle, setCircle] = useState<any[]>([]);
  const [crewEvents, setCrewEvents] = useState<any[]>([]);
  const [autopilotDismissed] = useState(() => localStorage.getItem("fc_autopilot_dismissed") === "true");
  const [showMoreSections, setShowMoreSections] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user || !profile) return;
      const today = new Date().toISOString().split("T")[0];
      const twoWeeksAgo = subDays(new Date(), 14).toISOString();
      const oneWeekAgo = subDays(new Date(), 7).toISOString();

      // Parallel fetches
      const [
        promptRes,
        rsvpRes,
        membersRes,
        statsPromptRes,
        statsEventsRes,
      ] = await Promise.all([
        // Active prompt
        supabase.from("prompts").select("*").eq("is_active", true).limit(1).single(),
        // User's upcoming RSVPs
        supabase.from("event_rsvps").select("*, events:event_id(*)").eq("user_id", user.id).eq("status", "going"),
        // All profiles for matches + new members
        supabase.from("profiles").select("*").eq("onboarding_completed", true),
        // Prompt answers this week
        supabase.from("prompt_responses").select("id", { count: "exact", head: true }).gte("created_at", oneWeekAgo),
        // Upcoming events count
        supabase.from("events").select("id", { count: "exact", head: true }).gte("date", today),
      ]);

      // Active prompt + check if user answered
      if (promptRes.data) {
        const { data: userResp } = await supabase
          .from("prompt_responses")
          .select("id")
          .eq("prompt_id", promptRes.data.id)
          .eq("user_id", user.id)
          .maybeSingle();

        setActivePrompt({
          id: promptRes.data.id,
          question: promptRes.data.question,
          emoji: promptRes.data.emoji,
          response_count: promptRes.data.response_count,
          userAnswered: !!userResp,
        });
      }

      // Next meetup (user's RSVP)
      let hasUserMeetup = false;
      if (rsvpRes.data && rsvpRes.data.length > 0) {
        const upcomingRsvps = rsvpRes.data
          .filter((r: any) => r.events && r.events.date >= today)
          .sort((a: any, b: any) => a.events.date.localeCompare(b.events.date));

        if (upcomingRsvps.length > 0) {
          const ev = upcomingRsvps[0].events;
          // Count others going
          const { count } = await supabase
            .from("event_rsvps")
            .select("id", { count: "exact", head: true })
            .eq("event_id", ev.id)
            .eq("status", "going");

          setNextMeetup({
            id: ev.id,
            title: ev.title,
            date: ev.date,
            start_time: ev.start_time,
            venue_name: ev.venue_name,
            goingCount: (count || 1) - 1,
          });
          hasUserMeetup = true;
        }
      }

      // If user has no RSVP, find any upcoming event to suggest
      if (!hasUserMeetup) {
        const { data: anyEvents } = await supabase.from("events")
          .select("id, title")
          .gte("date", today)
          .order("date", { ascending: true })
          .limit(1);
        if (anyEvents && anyEvents.length > 0) {
          const { count: evCount } = await supabase.from("event_rsvps")
            .select("id", { count: "exact", head: true })
            .eq("event_id", anyEvents[0].id)
            .eq("status", "going");
          setUpcomingEvent({ id: anyEvents[0].id, title: anyEvents[0].title, goingCount: evCount || 0 });
        }
      }

      // Members
      const profiles = membersRes.data || [];
      setAllProfiles(profiles);

      // New members (last 14 days, exclude self)
      const recent = profiles
        .filter((p) => p.id !== user.id && p.created_at && p.created_at >= twoWeeksAgo)
        .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
      setNewMembers(recent);

      // Stats
      setStats({
        totalMembers: profiles.length,
        promptAnswersThisWeek: statsPromptRes.count || 0,
        upcomingEvents: statsEventsRes.count || 0,
      });

      // Check pending feedback for past events
      const { data: rsvps } = await supabase.from("event_rsvps")
        .select("event_id, events:event_id(id, title, date)")
        .eq("user_id", user.id).eq("status", "going");
      if (rsvps) {
        const pastRsvps = rsvps.filter((r: any) => r.events && r.events.date < today);
        if (pastRsvps.length > 0) {
          const eventIds = pastRsvps.map((r: any) => r.events.id);
          const { data: feedback } = await supabase.from("event_feedback")
            .select("event_id").eq("user_id", user.id).in("event_id", eventIds);
          const feedbackIds = new Set((feedback || []).map((f) => f.event_id));
          setPendingFeedback(
            pastRsvps.filter((r: any) => !feedbackIds.has(r.events.id)).map((r: any) => r.events).slice(0, 1)
          );
        }
      }

      // Post-session summary (yesterday's events)
      const yesterday = subDays(new Date(), 1).toISOString().split("T")[0];
      const { data: yesterdayFeedback } = await supabase.from("event_feedback")
        .select("event_id, events:event_id(id, title, venue_name, start_time, end_time, session_format)")
        .eq("user_id", user.id).eq("attended", true);

      if (yesterdayFeedback) {
        const yesterdayEvent = yesterdayFeedback.find((f: any) => {
          const ev = f.events;
          return ev && ev.id; // Just take most recent attended
        });
        if (yesterdayEvent) {
          const ev = yesterdayEvent.events;
          // Get coworkers
          const { data: coworkerRsvps } = await supabase.from("event_rsvps")
            .select("profiles:user_id(display_name)")
            .eq("event_id", ev.id).eq("status", "going").neq("user_id", user.id).limit(5);
          const coworkers = (coworkerRsvps || []).map((r: any) => r.profiles?.display_name?.split(" ")[0] || "").filter(Boolean);

          // Get intention
          const { data: intentionData } = await supabase.from("session_intentions")
            .select("intention, accomplished").eq("event_id", ev.id).eq("user_id", user.id).maybeSingle();

          // Get props received
          const { data: props } = await supabase.from("peer_props")
            .select("prop_type").eq("to_user", user.id).eq("event_id", ev.id);
          const propCounts: Record<string, number> = {};
          (props || []).forEach((p: any) => { propCounts[p.prop_type] = (propCounts[p.prop_type] || 0) + 1; });

          setPostSessionSummary({
            eventTitle: ev.title,
            venueName: ev.venue_name,
            hours: 2, // approximate
            coworkers,
            intention: intentionData?.intention || null,
            accomplished: intentionData?.accomplished || null,
            propsReceived: Object.entries(propCounts).map(([prop_type, count]) => ({ prop_type, count })),
            streak: profile.current_streak || 0,
            eventId: ev.id,
          });
        }
      }

      // Weekly digest (Mondays)
      const now = new Date();
      if (isMonday(now)) {
        const weekStart = startOfWeek(subDays(now, 7), { weekStartsOn: 1 }).toISOString();
        const weekEnd = endOfWeek(subDays(now, 7), { weekStartsOn: 1 }).toISOString();

        const [weekFeedback, weekPropsGiven, weekPropsReceived, allProfs] = await Promise.all([
          supabase.from("event_feedback").select("id").eq("user_id", user.id).eq("attended", true).gte("created_at", weekStart).lte("created_at", weekEnd),
          supabase.from("peer_props").select("id", { count: "exact", head: true }).eq("from_user", user.id).gte("created_at", weekStart).lte("created_at", weekEnd),
          supabase.from("peer_props").select("id", { count: "exact", head: true }).eq("to_user", user.id).gte("created_at", weekStart).lte("created_at", weekEnd),
          supabase.from("profiles").select("focus_hours").eq("onboarding_completed", true),
        ]);

        const sessionsCount = weekFeedback.data?.length || 0;
        if (sessionsCount > 0) {
          const myHours = Number(profile.focus_hours ?? 0);
          const allHours = (allProfs.data || []).map(p => Number(p.focus_hours ?? 0)).sort((a, b) => b - a);
          const myRank = allHours.findIndex(h => h <= myHours) + 1;
          const topPercent = allHours.length > 0 ? Math.round((myRank / allHours.length) * 100) : null;

          setWeeklyDigest({
            sessions: sessionsCount,
            hours: sessionsCount * 2, // approximate
            propsGiven: weekPropsGiven.count || 0,
            propsReceived: weekPropsReceived.count || 0,
            streak: profile.current_streak || 0,
            topPercent,
          });
        }
      }

      // Nearby sessions via RPC
      if (profile.preferred_latitude && profile.preferred_longitude) {
        const { data: nearby } = await supabase.rpc('find_nearby_sessions', {
          p_latitude: profile.preferred_latitude,
          p_longitude: profile.preferred_longitude,
          p_radius_km: profile.preferred_radius_km || 5,
          p_limit: 5,
        });
        setNearbySessions(nearby || []);
      }

      // Session matching - fetch upcoming events
      const { data: allUpcoming } = await supabase.from("events")
        .select("*")
        .gte("date", today)
        .order("date", { ascending: true })
        .limit(20);

      if (allUpcoming && allUpcoming.length > 0) {
        const scored = allUpcoming
          .map(s => ({
            ...s,
            score: sessionMatchScore(
              { date: s.date, start_time: s.start_time, session_format: s.session_format, neighborhood: s.neighborhood },
              {
                preferred_days: profile.preferred_days ?? [],
                preferred_times: profile.preferred_times ?? [],
                preferred_session_duration: profile.preferred_session_duration ?? 2,
                preferred_radius_km: profile.preferred_radius_km ?? 5,
                work_vibe: profile.work_vibe ?? undefined,
              }
            ),
          }));
        setScoredSessions(scored.filter(s => s.score > 50).sort((a, b) => b.score - a.score).slice(0, 5));
        setDiscoverySessions(scored.filter(s => s.score < 30).slice(0, 3));
      }

      // Check milestones and re-engagement
      const milestone = await checkMilestones(user.id);
      if (milestone) setCelebrateMilestone(milestone);
      checkReEngagement(user.id);
      trackAnalyticsEvent("page_view", user.id, { page: "home" });

      // Enhanced weekly digest
      if (isMonday(new Date())) {
        const weekStart = startOfWeek(subDays(new Date(), 7), { weekStartsOn: 1 }).toISOString();
        const weekEnd = endOfWeek(subDays(new Date(), 7), { weekStartsOn: 1 }).toISOString();
        const [wf, wpg, wpr, commSessions, commProps] = await Promise.all([
          supabase.from("event_feedback").select("event_id").eq("user_id", user.id).eq("attended", true).gte("created_at", weekStart).lte("created_at", weekEnd),
          supabase.from("peer_props").select("id", { count: "exact", head: true }).eq("from_user", user.id).gte("created_at", weekStart).lte("created_at", weekEnd),
          supabase.from("peer_props").select("id", { count: "exact", head: true }).eq("to_user", user.id).gte("created_at", weekStart).lte("created_at", weekEnd),
          supabase.from("event_feedback").select("id", { count: "exact", head: true }).eq("attended", true).gte("created_at", weekStart).lte("created_at", weekEnd),
          supabase.from("peer_props").select("id", { count: "exact", head: true }).gte("created_at", weekStart).lte("created_at", weekEnd),
        ]);
        const sc = wf.data?.length || 0;
        if (sc > 0) {
          setEnhancedDigest({
            sessions: sc, hours: sc * 2, propsGiven: wpg.count || 0, propsReceived: wpr.count || 0,
            newPeopleMet: 0, streak: profile.current_streak || 0, topPercent: null,
            communityStats: { members: profiles.length, sessionsThisWeek: commSessions.count || 0, propsThisWeek: commProps.count || 0 },
            displayName: profile.display_name, referralCode: profile.referral_code,
          });
        }
      }

      // Fetch circle
      if ((profile.events_attended || 0) >= 2) {
        const { data: circleData } = await supabase.rpc("get_my_circle", { p_user_id: user.id });
        setCircle(circleData || []);

        // Social loss: circle members going to events user hasn't RSVP'd to
        if (circleData && circleData.length > 0) {
          const circleIds = circleData.map((c: any) => c.circle_user_id);
          const { data: circleRsvps } = await supabase
            .from("event_rsvps")
            .select("event_id, user_id, events:event_id(id, title, date, start_time, venue_name)")
            .in("user_id", circleIds)
            .eq("status", "going");
          if (circleRsvps) {
            const myRsvpIds = new Set(
              (rsvpRes.data || []).map((r: any) => r.events?.id).filter(Boolean)
            );
            const crewOnly = circleRsvps
              .filter((r: any) => r.events && r.events.date >= today && !myRsvpIds.has(r.events.id))
              .slice(0, 3);
            // Group by event
            const eventMap = new Map<string, any>();
            crewOnly.forEach((r: any) => {
              if (!eventMap.has(r.event_id)) {
                const member = circleData.find((c: any) => c.circle_user_id === r.user_id);
                eventMap.set(r.event_id, { ...r.events, members: [member].filter(Boolean) });
              } else {
                const member = circleData.find((c: any) => c.circle_user_id === r.user_id);
                if (member) eventMap.get(r.event_id).members.push(member);
              }
            });
            setCrewEvents(Array.from(eventMap.values()).slice(0, 2));
          }
        }
      }

      setLoading(false);
  }, [user, profile]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const completion = profile ? calculateProfileCompletion(profile) : 0;
  const nextAction = profile ? getNextAction(profile) : null;
  const handleRefresh = useCallback(async () => {
    await refreshProfile();
    await fetchAll();
  }, [refreshProfile, fetchAll]);

  if (!profile) return (
    <AppShell>
      <div className="px-4 py-6 space-y-4 max-w-lg mx-auto">
        <PersonalityLoader />
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
      </div>
    </AppShell>
  );

  return (
    <AppShell>
      <PullToRefresh onRefresh={handleRefresh}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="px-4 py-6 space-y-5 max-w-lg mx-auto"
      >
        {/* Greeting + Streak */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-xl text-foreground leading-snug">
              {(() => {
                const dynamicGreeting = personality.get?.('greetings', 'morning');
                return dynamicGreeting || getContextualGreeting({
                  firstName: getFirstName(profile.display_name),
                  isFirstVisit: (profile.events_attended || 0) === 0,
                  afterFirstSession: (profile.events_attended || 0) === 1,
                  isMonday: isMonday(new Date()),
                  isFriday: isFriday(new Date()),
                  attendedYesterday: !!postSessionSummary,
                  yesterdayVenue: postSessionSummary?.venueName,
                  yesterdayPeopleCount: postSessionSummary?.coworkers?.length,
                  streak: profile.current_streak || 0,
                });
              })()}
            </h1>
            <RankBadge focusHours={Number(profile.focus_hours ?? 0)} size="sm" />
          </div>
          <StreakIndicator userId={user!.id} />
        </div>

        {/* Credits Badge - full display */}
        <CreditsBadge balance={fcBalance} />

        {/* Growth Nudge - context-aware */}
        <GrowthNudgeCard userId={user!.id} />

        {/* Contribution Milestone - premium earn path */}
        <ContributionMilestoneCard userId={user!.id} />

        {/* Milestone Celebration */}
        {celebrateMilestone && (
          <MilestoneCelebration
            milestone={celebrateMilestone}
            userId={user!.id}
            referralCode={profile.referral_code}
            onDismiss={() => setCelebrateMilestone(null)}
          />
        )}

        {/* === TIER 1: Primary Action (most important card after greeting) === */}
        <PrimaryActionCard
          nextMeetup={nextMeetup}
          pendingFeedback={pendingFeedback}
          upcomingEvent={upcomingEvent}
        />

        {/* === TIER 2: Contextual, show when relevant === */}

        {/* Check-In / Community Section */}
        <FeatureGate featureFlag="check_in">
          {currentState === "offline" ? (
            <Card className="border-primary/20 bg-primary/5 cursor-pointer" onClick={() => setCheckInOpen(true)}>
              <CardContent className="p-4 flex items-center gap-3">
                <MapPin className="w-5 h-5 text-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Check In</p>
                  <p className="text-xs text-muted-foreground">See who's around and get matched</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ) : (
            <ActiveCheckInCard />
          )}
        </FeatureGate>

        {/* Streak warning (Thursday+) — moved to Tier 2 for urgency */}
        {(profile.events_attended || 0) >= 2 && (profile.current_streak || 0) >= 2 && new Date().getDay() >= 4 && (
          <Card className="border-yellow-500/20 bg-yellow-50/50 dark:bg-yellow-950/10">
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-yellow-600" /> Your {profile.current_streak}-week streak is at risk!
              </p>
              {!profile.streak_insurance_used_at || (new Date().getTime() - parseISO(profile.streak_insurance_used_at).getTime()) > 30 * 24 * 60 * 60 * 1000 ? (
                <>
                  <p className="text-xs text-muted-foreground">You have a streak save available, but booking a session is better!</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => navigate("/events")}>Book now</Button>
                    <Button size="sm" variant="secondary" onClick={async () => {
                      if (!user) return;
                      const { error } = await supabase.from("profiles").update({ streak_insurance_used_at: new Date().toISOString() }).eq("id", user.id);
                      if (error) { toast.error("Could not use streak save. Try again."); return; }
                      toast.success("Streak saved! You have one save per month.");
                      await refreshProfile();
                    }}>
                      <Shield className="w-3.5 h-3.5" /> Use Streak Save
                    </Button>
                  </div>
                </>
              ) : profile.streak_insurance_used_at && (new Date().getTime() - parseISO(profile.streak_insurance_used_at).getTime()) <= 7 * 24 * 60 * 60 * 1000 ? (
                <p className="text-xs text-green-600 font-medium">Streak protected until next week!</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">Book a session to keep your streak alive.</p>
                  <Button size="sm" variant="outline" onClick={() => navigate("/events")}>Book now</Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Gratitude Echo Card */}
        {(profile.events_attended || 0) >= 1 && <GratitudeEchoCard />}

        {/* Crew Events (circle FOMO) */}
        {(profile.events_attended || 0) >= 2 && crewEvents.length > 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 space-y-3">
              {crewEvents.map((ev: any) => (
                <div key={ev.id} className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/events/${ev.id}`)}>
                  <div className="flex -space-x-2">
                    {ev.members?.slice(0, 3).map((m: any) => (
                      <Avatar key={m.circle_user_id} className="w-7 h-7 border-2 border-background">
                        <AvatarImage src={m.avatar_url || ""} />
                        <AvatarFallback className="text-[9px] bg-muted">{m.display_name?.[0]}</AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground font-medium truncate">
                      {ev.members?.[0]?.display_name?.split(" ")[0]}{ev.members?.length > 1 ? ` + ${ev.members.length - 1} more` : ""} going to {ev.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{ev.date ? format(parseISO(ev.date), "EEE, MMM d") : ""}</p>
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0 text-xs h-7" onClick={e => { e.stopPropagation(); navigate(`/events/${ev.id}`); }}>Join</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Your Circle */}
        {(profile.events_attended || 0) >= 2 && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1">
                <UsersIcon className="w-3.5 h-3.5" /> Your Circle
              </p>
              {circle.length > 0 ? (
                <div className="flex gap-4 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                  {circle.slice(0, 8).map((c: any) => (
                    <div key={c.circle_user_id} className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer"
                      onClick={() => navigate(`/profile/${c.circle_user_id}`)}>
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={c.avatar_url || ""} />
                        <AvatarFallback className="text-xs bg-muted">{c.display_name?.[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-[11px] text-foreground text-center w-14 truncate">{c.display_name?.split(" ")[0]}</span>
                      <span className="text-[9px] text-muted-foreground">{c.cowork_count} sessions</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">
                  After your next session, tap "Cowork Again" on people you clicked with. Mutual picks appear here.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* DNA Completion Nudge — shows when < 50% complete */}
        {user && <DnaCompletionNudge userId={user.id} />}

        {/* === TIER 3: Engagement (collapsible) === */}
        <Collapsible open={showMoreSections} onOpenChange={setShowMoreSections}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <span>{showMoreSections ? "Show less" : "Show more"}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showMoreSections ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-5">
            {/* Community Rituals (Monday/Friday) */}
            {isMonday(new Date()) && (profile.events_attended || 0) >= 1 && (
              <CommunityRitualCard type="monday_intention" />
            )}
            {isFriday(new Date()) && (profile.events_attended || 0) >= 1 && (
              <CommunityRitualCard type="friday_win" />
            )}

            {/* Enhanced Weekly Digest */}
            {enhancedDigest ? (
              <EnhancedWeeklyDigest {...enhancedDigest} />
            ) : weeklyDigest && (
              <Card className="border-secondary/20 bg-secondary/5">
                <CardContent className="p-4 space-y-2">
                  <p className="font-serif text-sm text-foreground">Your Week in FocusClub</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span className="text-muted-foreground">Sessions: <span className="font-medium text-foreground">{weeklyDigest.sessions}</span></span>
                    <span className="text-muted-foreground">Deep work: <span className="font-medium text-foreground">{weeklyDigest.hours}h</span></span>
                    <span className="text-muted-foreground">Props given: <span className="font-medium text-foreground">{weeklyDigest.propsGiven}</span></span>
                    <span className="text-muted-foreground">Props received: <span className="font-medium text-foreground">{weeklyDigest.propsReceived}</span></span>
                  </div>
                  {weeklyDigest.streak > 0 && (
                    <p className="text-xs text-foreground">{weeklyDigest.streak} session streak!</p>
                  )}
                  {weeklyDigest.topPercent && weeklyDigest.topPercent <= 30 && (
                    <p className="text-xs text-secondary font-medium">You're in the top {weeklyDigest.topPercent}% of active members!</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Push Notification Opt-In */}
            <PushOptInCard />

            {/* DNA Prompt Card */}
            <FeatureGate featureFlag="taste_matching">
              {dnaComplete < 50 && (
                <Card className="border-secondary/20 bg-secondary/5">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Dna className="w-5 h-5 text-secondary shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Build your Work DNA</p>
                      <p className="text-xs text-muted-foreground">Help us find your people -- takes 3 minutes</p>
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={() => navigate("/me/dna")}>Start</Button>
                  </CardContent>
                </Card>
              )}
            </FeatureGate>

            {/* Streak Card + Activity Summary */}
            <StreakCard />
            <ActivitySummary />
          </CollapsibleContent>
        </Collapsible>

        {/* Community -- Who's Here + Match Suggestions */}
        {currentState !== "offline" ? (
          <>
            <WhosHere />
            <CompaniesHere />
            <MatchSuggestions />

            {/* Quick Actions row */}
            <div className="grid grid-cols-2 gap-3">
              <FeatureGate featureFlag="micro_requests">
                <Card className="border-border/50 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setMicroRequestsOpen(true)}>
                  <CardContent className="p-3 flex items-center gap-2">
                    <Hand className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">Ask for Help</p>
                      <p className="text-[10px] text-muted-foreground">Post a quick request</p>
                    </div>
                  </CardContent>
                </Card>
              </FeatureGate>
              <FeatureGate featureFlag="coffee_roulette">
                <Card className="border-border/50 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setCoffeeRouletteOpen(true)}>
                  <CardContent className="p-3 flex items-center gap-2">
                    <CoffeeIcon className="w-4 h-4 text-amber-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">Coffee Roulette</p>
                      <p className="text-[10px] text-muted-foreground">Get matched randomly</p>
                    </div>
                  </CardContent>
                </Card>
              </FeatureGate>
            </div>
          </>
        ) : (
          <FeatureGate featureFlag="whos_here">
            <Card className="border-border/50 bg-muted/30">
              <CardContent className="p-4 text-center space-y-2">
                <p className="text-sm text-muted-foreground">Check in to see who's around</p>
                <Button size="sm" variant="outline" onClick={() => setCheckInOpen(true)}>Check In</Button>
              </CardContent>
            </Card>
          </FeatureGate>
        )}

        <CheckInFlow open={checkInOpen} onClose={() => setCheckInOpen(false)} onCheckIn={() => { refreshCheckIn(); setCheckInOpen(false); }} />

        {/* Micro Requests Sheet */}
        <Sheet open={microRequestsOpen} onOpenChange={setMicroRequestsOpen}>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
            <SheetHeader>
              <SheetTitle className="font-serif text-lg">Quick Requests</SheetTitle>
            </SheetHeader>
            <MicroRequestBoard />
          </SheetContent>
        </Sheet>

        {/* Coffee Roulette Sheet */}
        <Sheet open={coffeeRouletteOpen} onOpenChange={setCoffeeRouletteOpen}>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
            <SheetHeader>
              <SheetTitle className="font-serif text-lg">Coffee Roulette</SheetTitle>
            </SheetHeader>
            <CoffeeRoulette />
          </SheetContent>
        </Sheet>

        {/* Captain Dashboard — only visible to table captains */}
        {profile?.is_table_captain && <CaptainDashboardCard />}

        {/* DESIGN: Autopilot gated to 3+ sessions — must prove the habit before automating it */}
        {(profile.events_attended || 0) >= 3 && !profile.autopilot_enabled && !autopilotDismissed && (
          <Card className="border-primary/20">
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-primary" /> Never miss a session
              </p>
              <p className="text-xs text-muted-foreground">Turn on Autopilot and we'll book your ideal sessions automatically.</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => navigate("/me?tab=settings")}>Set up</Button>
                <Button size="sm" variant="ghost" onClick={() => localStorage.setItem("fc_autopilot_dismissed", "true")}>Not now</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Autopilot status */}
        {profile.autopilot_enabled && (
          <Card className="border-secondary/20">
            <CardContent className="p-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              <span className="text-xs text-foreground font-medium flex-1">Autopilot is on</span>
              <button className="text-xs text-primary hover:underline" onClick={() => navigate("/me?tab=settings")}>Manage</button>
            </CardContent>
          </Card>
        )}

        {/* Progressive Profile Prompt */}
        <ProfilePromptCard profile={profile} />

        {/* Sessions Near You */}
        {!loading && profile.preferred_latitude && profile.preferred_longitude ? (
          nearbySessions.length > 0 ? (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">
                  <Navigation className="w-3.5 h-3.5 inline mr-1" />
                  Sessions within {profile.preferred_radius_km || 5}km
                </p>
                <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                  {nearbySessions.map((s: any) => (
                    <div key={s.event_id} className="shrink-0 w-44 rounded-lg border border-border bg-background p-3 cursor-pointer hover:shadow-sm transition-shadow"
                      onClick={() => navigate(`/events/${s.event_id}`)}>
                      <p className="text-xs font-medium text-foreground truncate">{s.title}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{s.venue_name}</p>
                      <p className="text-[10px] text-muted-foreground">{s.date ? format(parseISO(s.date), "EEE, MMM d") : ""}{s.start_time ? ` · ${s.start_time}` : ""}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                          {s.distance_km?.toFixed(1)} km
                        </Badge>
                        {s.max_spots && <span className="text-[10px] text-muted-foreground">{Math.max(0, s.max_spots - (s.rsvp_count || 0))} spots</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null
        ) : !loading ? (
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/me")}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-0.5">📍 Set your location</p>
                <p className="text-xs text-foreground">See nearby sessions tailored to you</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        ) : null}

        {/* Perfect For You */}
        {!loading && scoredSessions.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">
                <Sparkles className="w-3.5 h-3.5 inline mr-1" />
                Perfect for you
              </p>
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                {scoredSessions.map((s: any) => (
                  <div key={s.id} className="shrink-0 w-44 rounded-lg border border-border bg-background p-3 cursor-pointer hover:shadow-sm transition-shadow"
                    onClick={() => navigate(`/events/${s.id}`)}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-foreground truncate flex-1">{s.title}</p>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-secondary/40 text-secondary ml-1 shrink-0">
                        {s.score}%
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{s.venue_name}</p>
                    <p className="text-[10px] text-muted-foreground">{s.date ? format(parseISO(s.date), "EEE, MMM d") : ""}{s.start_time ? ` · ${s.start_time}` : ""}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Try Something New */}
        {!loading && discoverySessions.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">🧭 Try something new</p>
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                {discoverySessions.map((s: any) => (
                  <div key={s.id} className="shrink-0 w-44 rounded-lg border border-border bg-background p-3 cursor-pointer hover:shadow-sm transition-shadow"
                    onClick={() => navigate(`/events/${s.id}`)}>
                    <p className="text-xs font-medium text-foreground truncate">{s.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{s.venue_name}</p>
                    <p className="text-[10px] text-muted-foreground">{s.date ? format(parseISO(s.date), "EEE, MMM d") : ""}{s.start_time ? ` · ${s.start_time}` : ""}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Community Highlight — after 1+ session */}
        {(profile.events_attended || 0) >= 1 && <CommunityHighlight />}

        {/* Post-Session Summary */}
        {postSessionSummary && (
          <Card className="border-primary/20">
            <CardContent className="p-4 space-y-2">
              <p className="font-serif text-sm text-foreground">Yesterday at {postSessionSummary.eventTitle} 📍</p>
              {postSessionSummary.venueName && (
                <p className="text-xs text-muted-foreground">{postSessionSummary.venueName}</p>
              )}
              {postSessionSummary.coworkers.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  You worked with {postSessionSummary.coworkers.join(", ")}
                </p>
              )}
              {postSessionSummary.intention && (
                <p className="text-xs text-foreground">
                  Intention: "{postSessionSummary.intention}" {postSessionSummary.accomplished === "yes" ? "✅" : postSessionSummary.accomplished === "partially" ? "🔄" : "💪"}
                </p>
              )}
              {postSessionSummary.propsReceived.length > 0 && (
                <p className="text-xs text-foreground">
                  Props received: {postSessionSummary.propsReceived.map(p => {
                    const emojis: Record<string, string> = { energy: "⚡", helpful: "🤝", focused: "🎯", inspiring: "💡", fun: "🎉", kind: "💛" };
                    return `${emojis[p.prop_type] || ""} ${p.count}`;
                  }).join(" · ")}
                </p>
              )}
              {postSessionSummary.streak > 0 && (
                <p className="text-xs font-medium text-primary">🔥 {postSessionSummary.streak} session streak!</p>
              )}
              <WhatsAppShareButton
                message={`Just did a ${postSessionSummary.hours}-hour coworking session with ${postSessionSummary.coworkers.length} amazing people${postSessionSummary.venueName ? ` at ${postSessionSummary.venueName}` : ""} through FocusClub! 🎯\nIf you work remotely or freelance in Bangalore, check it out: ${window.location.origin}/invite/${profile.referral_code || ""}`}
                label="Share your experience"
                size="sm"
                variant="outline"
              />
            </CardContent>
          </Card>
        )}

        {/* Props Flow */}
        {showPropsForEvent && (
          <GivePropsFlow eventId={showPropsForEvent} onDone={() => {
            setShowPropsForEvent(null);
            // Show post-event share card
          }} />
        )}

        {/* Post-Event Share */}
        {postSessionSummary && !showPropsForEvent && (
          <PostEventShareCard
            hours={postSessionSummary.hours}
            peopleCount={postSessionSummary.coworkers.length + 1}
            venue={postSessionSummary.venueName}
            referralCode={profile.referral_code}
            eventUrl={`${window.location.origin}/events/${postSessionSummary.eventId}`}
          />
        )}

        {/* Pending Feedback */}
        {!showPropsForEvent && pendingFeedback.map((ev) => (
          <Card key={ev.id} className="border-primary/20">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">How was {ev.title}?</p>
              <div className="flex justify-center gap-3">
                {[
                  { v: 1, e: "😞" }, { v: 2, e: "😐" }, { v: 3, e: "🙂" }, { v: 4, e: "😊" }, { v: 5, e: "🤩" },
                ].map((r) => (
                  <button key={r.v} className="text-2xl hover:scale-125 transition-transform p-1"
                    onClick={async () => {
                      try {
                        const { error } = await supabase.from("event_feedback").insert({ event_id: ev.id, user_id: user!.id, rating: r.v, attended: true });
                        if (error) throw error;
                        const { data: prof } = await supabase.from("profiles").select("events_attended").eq("id", user!.id).single();
                        await supabase.from("profiles").update({ events_attended: (prof?.events_attended || 0) + 1 }).eq("id", user!.id);

                        // Add focus hours
                        const { data: eventData } = await supabase.from("events").select("title, start_time, end_time, session_format").eq("id", ev.id).single();
                        if (eventData) {
                          const hours = calculateSessionHours(eventData.start_time, eventData.end_time, eventData.title, eventData.session_format);
                          await addFocusHours(user!.id, hours);
                        }

                        setPendingFeedback((p) => p.filter((e) => e.id !== ev.id));
                        setShowPropsForEvent(ev.id);
                      } catch (error) {
                        console.error("[EventFeedback]", error);
                        toast.error(ERROR_STATES.generic);
                      }
                    }}>
                    {r.e}
                  </button>
                ))}
              </div>
              <button className="text-xs text-muted-foreground hover:underline" onClick={async () => {
                try {
                  const { error } = await supabase.from("event_feedback").insert({ event_id: ev.id, user_id: user!.id, attended: false });
                  if (error) throw error;
                  const { data: prof } = await supabase.from("profiles").select("events_no_show").eq("id", user!.id).single();
                  await supabase.from("profiles").update({ events_no_show: (prof?.events_no_show || 0) + 1 }).eq("id", user!.id);
                  setPendingFeedback((p) => p.filter((e) => e.id !== ev.id));
                } catch (error) {
                  console.error("[EventNoShow]", error);
                  toast.error(ERROR_STATES.generic);
                }
              }}>I didn't attend</button>
            </CardContent>
          </Card>
        ))}

        {/* Card 1: This Week's Prompt */}
        {loading ? <Skeleton className="h-28 rounded-lg" /> : activePrompt && (
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/prompts")}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{activePrompt.emoji || "💬"}</span>
                <div className="flex-1 min-w-0">
                   <p className="text-xs font-medium text-muted-foreground mb-1">This week's question</p>
                   <p className="font-serif text-base text-foreground line-clamp-2">{activePrompt.question}</p>
                  {activePrompt.userAnswered ? (
                    <div className="mt-2 space-y-1.5">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-secondary" />
                        You answered · See {activePrompt.response_count || 0} other answers →
                      </p>
                      <WhatsAppShareButton
                        message={getPromptInviteMessage(activePrompt.question, profile.referral_code)}
                        label="Invite someone to answer"
                        size="sm"
                        variant="ghost"
                        className="text-xs h-7 px-2"
                      />
                    </div>
                  ) : (
                    <Button size="sm" className="mt-2 h-8 text-xs" onClick={(e) => { e.stopPropagation(); navigate("/prompts"); }}>
                      Share your answer <ArrowRight className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Weekly Digest */}
        <WeeklyDigest />

        {/* Card 2: Your Next Meetup */}
        {loading ? <Skeleton className="h-24 rounded-lg" /> : nextMeetup ? (
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/events/${nextMeetup.id}`)}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">Your next session</p>
              <h3 className="font-serif text-base text-foreground">{nextMeetup.title}</h3>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" />{format(parseISO(nextMeetup.date), "EEE, MMM d")}{nextMeetup.start_time ? ` · ${nextMeetup.start_time}` : ""}</span>
                {nextMeetup.venue_name && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{nextMeetup.venue_name}</span>}
              </div>
              {nextMeetup.goingCount > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{nextMeetup.goingCount} other{nextMeetup.goingCount !== 1 ? "s" : ""} going</p>
              )}
              <div className="mt-2">
                <AddToCalendarButton
                  event={{
                    title: nextMeetup.title,
                    date: nextMeetup.date,
                    startTime: nextMeetup.start_time,
                    endTime: null,
                    venueName: nextMeetup.venue_name,
                    venueAddress: null,
                  }}
                  size="sm"
                  variant="outline"
                />
              </div>
            </CardContent>
          </Card>
        ) : upcomingEvent ? (
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/events/${upcomingEvent.id}`)}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">Upcoming</p>
              <h3 className="font-serif text-base text-foreground">{upcomingEvent.title}</h3>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs text-muted-foreground">{upcomingEvent.goingCount} going</span>
                <span className="text-xs text-primary">See details →</span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/events")}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-0.5">No sessions on the board</p>
                <p className="font-serif text-base text-foreground">Browse sessions →</p>
              </div>
              <CalendarIcon className="w-5 h-5 text-muted-foreground" />
            </CardContent>
          </Card>
        )}

        {/* Card 3: New Faces */}
        {loading ? <Skeleton className="h-28 rounded-lg" /> : newMembers.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">
                <Sparkles className="w-3.5 h-3.5 inline mr-1" />
                {newMembers.length} new {newMembers.length !== 1 ? "faces" : "face"} this week
              </p>
              <div className="flex gap-4 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                {newMembers.slice(0, 10).map((m) => (
                  <div key={m.id} className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer" onClick={() => navigate(`/profile/${m.id}`)}>
                    <RankAvatar avatarUrl={m.avatar_url} displayName={m.display_name} focusHours={Number(m.focus_hours ?? 0)} size="md" />
                    <span className="text-[11px] text-muted-foreground text-center w-14 truncate">{m.display_name?.split(" ")[0] || "New"}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Card 4: Match Nudges — proactive contextual recommendations */}
        <MatchNudgeCard
          userId={user.id}
          userProfile={profile}
          allProfiles={allProfiles}
          loading={loading}
        />

        {/* Leaderboard Card — after 3+ sessions */}
        {!loading && (profile.events_attended || 0) >= 3 && <LeaderboardHomeCard />}

        {/* Card 5: Community Pulse — after 2+ sessions */}
        {!loading && (profile.events_attended || 0) >= 2 && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">Community pulse</p>
              <div className="flex items-center gap-1.5 text-xs text-foreground flex-wrap">
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-muted-foreground" />{stats.totalMembers} members</span>
                <span className="text-muted-foreground">·</span>
                <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />{stats.promptAnswersThisWeek} answers this week</span>
                <span className="text-muted-foreground">·</span>
                <span className="flex items-center gap-1"><CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />{stats.upcomingEvents} sessions coming up</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Card 6: Complete Your Profile */}
        {completion < 80 && (
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/me")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground">Your profile is... a work in progress. Like all great art.</p>
                <span className="text-xs font-medium text-primary">{completion}%</span>
              </div>
              <Progress value={completion} className="h-1.5 mb-2" />
              {nextAction && (
                <p className="text-xs text-muted-foreground">{nextAction} <ArrowRight className="w-3 h-3 inline" /></p>
              )}
            </CardContent>
          </Card>
        )}

        {/* === TIER 4: Promotional (bottom of page) === */}
        <UpgradeSessionPrompt />
        <BoostMathBanner />
      </motion.div>
      </PullToRefresh>
    </AppShell>
  );
}
