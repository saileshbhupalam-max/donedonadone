import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { PersonalityLoader } from "@/components/ui/PersonalityLoader";
import { ArrowLeft, Music, ExternalLink, Flag } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { toast } from "sonner";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Tables } from "@/integrations/supabase/types";
import { IcebreakerEngine } from "@/components/session/IcebreakerEngine";
import { EnergyCheck } from "@/components/session/EnergyCheck";
import { PhotoMoment } from "@/components/session/PhotoMoment";
import { SessionWrapUp } from "@/components/session/SessionWrapUp";
import { CoworkAgainCard } from "@/components/session/CoworkAgainCard";
import { VenueVibeRating } from "@/components/session/VenueVibeRating";
import { SkillSwapSuggestion } from "@/components/session/SkillSwapSuggestion";
import { GivePropsFlow } from "@/components/session/GivePropsFlow";
import { selectIcebreakerRounds, IcebreakerRound } from "@/lib/icebreakers";
import { CAPTAIN_NUDGES, updateReliability } from "@/lib/antifragile";
import { CONFIRMATIONS } from "@/lib/personality";
import { trackAnalyticsEvent } from "@/lib/growth";
import { FlagMemberForm } from "@/components/session/FlagMemberForm";
import { CheckInButton } from "@/components/session/CheckInButton";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { CaptainBadge } from "@/components/captain/CaptainCard";
import { ScrapbookPrompt } from "@/components/session/ScrapbookPrompt";

type Profile = Tables<"profiles">;

interface Phase {
  id: string;
  phase_order: number;
  phase_type: string;
  phase_label: string;
  duration_minutes: number;
}

interface MemberStatusRow {
  user_id: string;
  status: string;
  until_time: string | null;
  topic: string | null;
  profile?: Profile;
}

const PHASE_EMOJIS: Record<string, string> = {
  icebreaker: "👋",
  deep_work: "🎯",
  mini_break: "☕",
  social_break: "🗣️",
  wrap_up: "🎉",
};

const STATUS_CONFIG = {
  red: { label: "Deep Focus", emoji: "🔴", ringClass: "ring-destructive" },
  amber: { label: "Open to Chat", emoji: "🟡", ringClass: "ring-[hsl(40,80%,55%)]" },
  green: { label: "Free", emoji: "🟢", ringClass: "ring-secondary" },
};

export default function SessionPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  usePageTitle("Session — FocusClub");

  const [event, setEvent] = useState<any>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPhaseIdx, setCurrentPhaseIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [phaseStartTime, setPhaseStartTime] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Intention
  const [intention, setIntention] = useState("");
  const [intentionSaved, setIntentionSaved] = useState(false);
  const [accomplished, setAccomplished] = useState<string | null>(null);

  // Traffic light
  const [myStatus, setMyStatus] = useState<string>("green");
  const [topic, setTopic] = useState("");
  const [groupStatuses, setGroupStatuses] = useState<MemberStatusRow[]>([]);

  // Icebreakers
  const [icebreakerRounds, setIcebreakerRounds] = useState<IcebreakerRound[]>([]);
  const [icebreakerActive, setIcebreakerActive] = useState(false);
  const [icebreakerDone, setIcebreakerDone] = useState(false);

  // Session extras timing
  const [energyCheckShown, setEnergyCheckShown] = useState(false);
  const [photoMomentShown, setPhotoMomentShown] = useState(false);
  const [showProps, setShowProps] = useState(false);
  const [scrapbookGenerated, setScrapbookGenerated] = useState(false);

  // Load event + phases
  useEffect(() => {
    if (!eventId) return;
    (async () => {
      const { data: ev } = await supabase.from("events").select("*").eq("id", eventId).single();
      if (!ev) { setLoading(false); return; }
      setEvent(ev);

      const { data: ph } = await supabase
        .from("session_phases")
        .select("*")
        .eq("event_id", eventId)
        .order("phase_order", { ascending: true });
      setPhases(ph || []);

      // Check if already checked in
      if (user) {
        const { data: rsvp } = await supabase
          .from("event_rsvps")
          .select("checked_in")
          .eq("event_id", eventId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (rsvp?.checked_in) {
          setCheckedIn(true);
        }
      }

      // Load existing intention
      if (user) {
        const { data: intent } = await supabase
          .from("session_intentions")
          .select("*")
          .eq("event_id", eventId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (intent) {
          setIntention(intent.intention || "");
          setIntentionSaved(true);
          setAccomplished(intent.accomplished || null);
        }
      }

      setLoading(false);
    })();
  }, [eventId, user]);

  // Load icebreakers when session starts with icebreaker phase
  useEffect(() => {
    if (!sessionStarted || icebreakerDone || icebreakerRounds.length > 0) return;
    const currentPhase = phases[currentPhaseIdx];
    if (currentPhase?.phase_type === "icebreaker") {
      (async () => {
        // Determine group experience
        const otherProfiles = groupStatuses.map(s => s.profile).filter(Boolean) as Profile[];
        const avgAttended = otherProfiles.length > 0
          ? otherProfiles.reduce((a, p) => a + (p.events_attended || 0), 0) / otherProfiles.length
          : 0;
        const experience = avgAttended < 2 ? "new" : avgAttended >= 3 ? "experienced" : "mixed";
        const rounds = await selectIcebreakerRounds(experience);
        setIcebreakerRounds(rounds);
        if (rounds.length > 0) setIcebreakerActive(true);
      })();
    }
  }, [sessionStarted, currentPhaseIdx, phases, icebreakerDone]);

  // Load group statuses + realtime
  useEffect(() => {
    if (!eventId || !user) return;

    const loadStatuses = async () => {
      const { data: statuses } = await supabase
        .from("member_status")
        .select("*")
        .eq("event_id", eventId);
      if (!statuses) return;

      const userIds = statuses.map((s: any) => s.user_id);
      const { data: profiles } = userIds.length > 0
        ? await supabase.from("profiles").select("*").in("id", userIds)
        : { data: [] as Profile[] };
      const profileMap = new Map<string, Profile>();
      profiles?.forEach(p => profileMap.set(p.id, p));

      setGroupStatuses(statuses.map((s: any) => ({ ...s, profile: profileMap.get(s.user_id) })));
      const mine = statuses.find((s: any) => s.user_id === user.id);
      if (mine) setMyStatus(mine.status);
    };

    loadStatuses();

    const channel = supabase
      .channel(`session-status-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "member_status", filter: `event_id=eq.${eventId}` }, () => {
        loadStatuses();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId, user]);

  // Timer logic
  useEffect(() => {
    if (!sessionStarted || !phases[currentPhaseIdx]) return;
    const dur = phases[currentPhaseIdx].duration_minutes * 60;
    setTimeLeft(dur);
    setPhaseStartTime(Date.now());
    setEnergyCheckShown(false);
    setPhotoMomentShown(false);

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          if (currentPhaseIdx < phases.length - 1) {
            setTimeout(() => setCurrentPhaseIdx(i => i + 1), 3000);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [sessionStarted, currentPhaseIdx, phases]);

  // Auto-set status based on phase + captain nudges
  useEffect(() => {
    if (!sessionStarted || !phases[currentPhaseIdx] || !user) return;
    const phase = phases[currentPhaseIdx];
    if (phase.phase_type === "deep_work") {
      updateMyStatus("red");
    } else if (phase.phase_type === "social_break" || phase.phase_type === "icebreaker") {
      updateMyStatus("green");
    }
    // Captain nudge
    if (profile?.is_table_captain && CAPTAIN_NUDGES[phase.phase_type]) {
      toast(CAPTAIN_NUDGES[phase.phase_type], { duration: 6000 });
    }
  }, [currentPhaseIdx, sessionStarted]);

  // Energy check timing (2 min into social break)
  useEffect(() => {
    const phase = phases[currentPhaseIdx];
    if (phase?.phase_type === "social_break" && !energyCheckShown) {
      const elapsed = phase.duration_minutes * 60 - timeLeft;
      if (elapsed >= 120) setEnergyCheckShown(true);
    }
    // Photo moment (last 2 min of social break)
    if (phase?.phase_type === "social_break" && !photoMomentShown) {
      if (timeLeft <= 120 && timeLeft > 0) setPhotoMomentShown(true);
    }
  }, [timeLeft, currentPhaseIdx, phases]);

  const updateMyStatus = async (status: string, ut?: string, tp?: string) => {
    if (!user || !eventId) return;
    setMyStatus(status);
    await supabase.from("member_status").upsert({
      user_id: user.id,
      event_id: eventId,
      status,
      until_time: ut || null,
      topic: tp || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  };

  const saveIntention = async (intentionText?: string) => {
    const text = intentionText || intention.trim();
    if (!user || !eventId || !text) return;
    setIntention(text);
    await supabase.from("session_intentions").upsert({
      user_id: user.id,
      event_id: eventId,
      intention: text,
    }, { onConflict: "user_id,event_id" });
    setIntentionSaved(true);
    toast.success(CONFIRMATIONS.intentionSet);
  };

  const saveAccomplished = async (val: string) => {
    if (!user || !eventId) return;
    setAccomplished(val);
    await supabase.from("session_intentions").update({ accomplished: val })
      .eq("user_id", user.id).eq("event_id", eventId);
  };

  const startSession = () => {
    setSessionStarted(true);
    if (user && eventId) {
      updateMyStatus("green");
      // Track check-in / session start
      updateReliability(user.id, 'show').catch(() => {});
      trackAnalyticsEvent('checkin', user.id, { event_id: eventId }).catch(() => {});
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // Skill swap suggestions
  const skillSwapMatches = useMemo(() => {
    if (!profile || !phases[currentPhaseIdx]) return [];
    const phase = phases[currentPhaseIdx];
    if (phase.phase_type !== "social_break" && phase.phase_type !== "mini_break") return [];

    const myLooking = (profile.looking_for || []).map(l => l.toLowerCase());
    return groupStatuses
      .filter(s => s.user_id !== user?.id && (s.status === "amber" || s.status === "green") && s.profile)
      .map(s => {
        const theirOffers = (s.profile!.can_offer || []).map(o => o.toLowerCase());
        const matching = theirOffers.filter(o => myLooking.some(l => o.includes(l) || l.includes(o)));
        return { profile: s.profile!, matchingSkills: matching };
      })
      .filter(m => m.matchingSkills.length > 0);
  }, [groupStatuses, profile, currentPhaseIdx, phases, user]);

  if (loading) return (
    <AppShell><div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
      <PersonalityLoader /><Skeleton className="h-8 w-32" /><Skeleton className="h-64" />
    </div></AppShell>
  );

  if (!event || phases.length === 0) return (
    <AppShell><div className="px-4 py-4 max-w-lg mx-auto text-center space-y-4">
      <p className="text-muted-foreground">This session doesn't have a structured format.</p>
      <Button variant="outline" onClick={() => navigate(-1)}>Go back</Button>
    </div></AppShell>
  );

  const currentPhase = phases[currentPhaseIdx];
  const totalDuration = phases.reduce((a, p) => a + p.duration_minutes, 0);

  // Props flow
  if (showProps) {
    return (
      <AppShell>
        <div className="px-4 py-4 max-w-lg mx-auto">
          <GivePropsFlow eventId={eventId!} onDone={() => setShowProps(false)} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="font-serif text-xl text-foreground">{event.title}</h1>

        {!sessionStarted ? (
          <Card className="border-primary/20">
            <CardContent className="p-6 text-center space-y-4">
              <p className="font-serif text-lg text-foreground">Ready to start?</p>
              <div className="space-y-2">
                {phases.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 text-sm">
                    <span className="text-lg">{PHASE_EMOJIS[p.phase_type] || "📋"}</span>
                    <span className="flex-1 text-left text-foreground">{p.phase_label}</span>
                    <span className="text-muted-foreground">{p.duration_minutes}min</span>
                  </div>
                ))}
              </div>
              {event.vibe_soundtrack && (
                <a href={event.vibe_soundtrack} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  <Music className="w-3 h-3" /> Session Playlist <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {!checkedIn ? (
                <CheckInButton
                  eventId={eventId!}
                  userId={user?.id || ""}
                  onCheckedIn={() => {
                    setCheckedIn(true);
                    startSession();
                  }}
                  hasVenueCoords={!!event?.venue_latitude}
                />
              ) : (
                <Button className="w-full" onClick={startSession}>Start Session</Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Phase dots */}
            <div className="flex items-center justify-center gap-2">
              {phases.map((p, i) => (
                <div key={p.id} className={cn(
                  "w-3 h-3 rounded-full transition-all",
                  i < currentPhaseIdx ? "bg-primary" :
                  i === currentPhaseIdx ? "bg-primary animate-pulse scale-125" : "bg-border"
                )} />
              ))}
            </div>

            {/* Current phase label */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                {PHASE_EMOJIS[currentPhase.phase_type]} {currentPhase.phase_label}
              </p>
            </div>

            {/* ICEBREAKER ENGINE */}
            {currentPhase.phase_type === "icebreaker" && icebreakerActive && !icebreakerDone && (
              <IcebreakerEngine
                rounds={icebreakerRounds}
                onComplete={() => {
                  setIcebreakerActive(false);
                  setIcebreakerDone(true);
                }}
                onIntentionSet={(text) => saveIntention(text)}
              />
            )}

            {/* Timer ring (hide during active icebreaker) */}
            {!(currentPhase.phase_type === "icebreaker" && icebreakerActive && !icebreakerDone) && (
              <>
                <div className="flex justify-center">
                  <div className="relative w-48 h-48">
                    <svg className="w-48 h-48 -rotate-90" viewBox="0 0 200 200">
                      <circle cx="100" cy="100" r="85" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
                      <circle
                        cx="100" cy="100" r="85" fill="none"
                        stroke="hsl(var(--primary))" strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 85}
                        strokeDashoffset={2 * Math.PI * 85 * (1 - timeLeft / (currentPhase.duration_minutes * 60))}
                        className="transition-all duration-1000"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold text-foreground font-mono">{formatTime(timeLeft)}</span>
                      <span className="text-xs text-muted-foreground mt-1">remaining</span>
                    </div>
                  </div>
                </div>

                {/* Phase list */}
                <div className="space-y-1.5">
                  {phases.map((p, i) => (
                    <div key={p.id} className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                      i === currentPhaseIdx ? "bg-primary/10 text-foreground font-medium" :
                      i < currentPhaseIdx ? "text-muted-foreground line-through" :
                      "text-muted-foreground"
                    )}>
                      <span>{PHASE_EMOJIS[p.phase_type]}</span>
                      <span className="flex-1">{p.phase_label}</span>
                      <span className="text-xs">{p.duration_minutes}m</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Intention prompt during deep work */}
            {currentPhase.phase_type === "deep_work" && !intentionSaved && (
              <Card className="border-primary/20">
                <CardContent className="p-4 space-y-3">
                  <p className="font-serif text-sm text-foreground">Set your intention for this session</p>
                  <Input
                    value={intention}
                    onChange={e => setIntention(e.target.value.slice(0, 140))}
                    placeholder="What do you want to accomplish?"
                    maxLength={140}
                  />
                  <Button size="sm" onClick={() => saveIntention()} disabled={!intention.trim()}>Set Intention 🎯</Button>
                </CardContent>
              </Card>
            )}

            {/* ENERGY CHECK during social break */}
            {(currentPhase.phase_type === "social_break" || currentPhase.phase_type === "mini_break") && energyCheckShown && eventId && (
              <EnergyCheck eventId={eventId} phase={currentPhase.phase_label} />
            )}

            {/* PHOTO MOMENT during social break */}
            {currentPhase.phase_type === "social_break" && photoMomentShown && eventId && (
              <PhotoMoment eventId={eventId} />
            )}

            {/* SKILL SWAP during breaks */}
            {skillSwapMatches.length > 0 && (
              <SkillSwapSuggestion matches={skillSwapMatches} />
            )}

            {/* WRAP-UP PHASE */}
            {currentPhase.phase_type === "wrap_up" && eventId && (
              <>
                <SessionWrapUp
                  eventId={eventId}
                  intention={intention}
                  intentionSaved={intentionSaved}
                  totalMinutes={totalDuration}
                  groupSize={groupStatuses.length}
                  onAccomplished={saveAccomplished}
                  onPropsClick={() => setShowProps(true)}
                  onFeedbackClick={() => navigate(`/events/${eventId}`)}
                />
                {user && (
                  <CoworkAgainCard
                    eventId={eventId}
                    userId={user.id}
                    groupMembers={groupStatuses.map(s => ({
                      user_id: s.user_id,
                      display_name: s.profile?.display_name || null,
                      avatar_url: s.profile?.avatar_url || null,
                    }))}
                  />
                )}

                {/* DESIGN: Venue vibes are crowdsourced — users trust peer data more than venue marketing.
                   Quick 10-second rating after each session builds venue intelligence. */}
                {user && event.venue_name && (
                  <VenueVibeRating
                    eventId={eventId}
                    userId={user.id}
                    venueName={event.venue_name}
                    onDone={() => {}}
                  />
                )}

                {/* DESIGN: Auto-generate scrapbook entry after wrap-up.
                   Users won't manually create memories — we gather everything automatically. */}
                {user && !scrapbookGenerated && (
                  <ScrapbookPrompt
                    eventId={eventId}
                    userId={user.id}
                    event={event}
                    intention={intention}
                    accomplished={accomplished}
                    totalMinutes={totalDuration}
                    groupMembers={groupStatuses.map(s => ({
                      user_id: s.user_id,
                      display_name: s.profile?.display_name || null,
                      avatar_url: s.profile?.avatar_url || null,
                    }))}
                    onGenerated={() => setScrapbookGenerated(true)}
                  />
                )}
              </>
            )}

            {/* Smart suggestions (legacy) */}
            {currentPhase.phase_type === "social_break" && skillSwapMatches.length === 0 && (
              (() => {
                const suggestions = groupStatuses
                  .filter(s => s.user_id !== user?.id && s.status === "amber" && s.topic)
                  .filter(s => {
                    const theirTopics = (s.topic || "").toLowerCase().split(",").map(t => t.trim());
                    const myLooking = (profile?.looking_for || []).map(l => l.toLowerCase());
                    return theirTopics.some(t => myLooking.some(l => t.includes(l) || l.includes(t)));
                  });
                if (suggestions.length === 0) return null;
                return (
                  <Card className="border-secondary/20 bg-secondary/5">
                    <CardContent className="p-3 space-y-2">
                      <p className="text-xs font-medium text-secondary">💡 Suggested connections</p>
                      {suggestions.map(s => (
                        <div key={s.user_id} className="flex items-center gap-2 text-sm">
                          <Avatar className="w-6 h-6">
                            <AvatarImage src={s.profile?.avatar_url || ""} />
                            <AvatarFallback className="text-[9px]">{getInitials(s.profile?.display_name)}</AvatarFallback>
                          </Avatar>
                          <span className="text-foreground">{s.profile?.display_name?.split(" ")[0]}</span>
                          <span className="text-muted-foreground text-xs">can help with {s.topic}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })()
            )}

            {/* Traffic Light Status */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="font-serif text-sm text-foreground">Your Status</h3>
                <div className="flex gap-2">
                  {(["red", "amber", "green"] as const).map(s => (
                    <Button
                      key={s}
                      size="sm"
                      variant={myStatus === s ? "default" : "outline"}
                      className={cn("flex-1", myStatus === s && s === "red" && "bg-destructive text-destructive-foreground",
                        myStatus === s && s === "green" && "bg-secondary text-secondary-foreground")}
                      onClick={() => updateMyStatus(s, undefined, topic || undefined)}
                    >
                      {STATUS_CONFIG[s].emoji} {STATUS_CONFIG[s].label}
                    </Button>
                  ))}
                </div>
                {myStatus === "amber" && (
                  <Input
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="Topics you're open to discuss"
                    onBlur={() => updateMyStatus("amber", undefined, topic)}
                    className="text-xs"
                  />
                )}

                <h3 className="font-serif text-sm text-foreground mt-3">Your Table</h3>
                <div className="space-y-2">
                  {groupStatuses.filter(s => s.user_id !== user?.id).map(s => {
                    const cfg = STATUS_CONFIG[s.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.green;
                    return (
                      <div key={s.user_id} className="flex items-center gap-3">
                        <div className={cn("rounded-full ring-2 p-0.5", cfg.ringClass)}>
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={s.profile?.avatar_url || ""} />
                            <AvatarFallback className="text-[10px]">{getInitials(s.profile?.display_name)}</AvatarFallback>
                          </Avatar>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-foreground">{s.profile?.display_name || "Member"}</p>
                            {s.profile?.is_table_captain && <CaptainBadge />}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {s.status === "red" && `Deep focus${s.until_time ? ` until ${new Date(s.until_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}`}
                            {s.status === "amber" && `💬 ${s.topic || "Open to chat"}`}
                            {s.status === "green" && "☕ Light work, come chat"}
                          </p>
                        </div>
                        <span className="text-lg">{cfg.emoji}</span>
                        <Dialog>
                          <DialogTrigger asChild>
                            <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-destructive" title="Report">
                              <Flag className="w-3.5 h-3.5" />
                            </button>
                          </DialogTrigger>
                          <DialogContent>
                            <FlagMemberForm
                              eventId={eventId!}
                              attendees={groupStatuses.filter(gs => gs.user_id !== user?.id).map(gs => ({
                                id: gs.user_id,
                                display_name: gs.profile?.display_name || null,
                                avatar_url: gs.profile?.avatar_url || null,
                              }))}
                              onDone={() => {}}
                            />
                          </DialogContent>
                        </Dialog>
                      </div>
                    );
                  })}
                  {groupStatuses.filter(s => s.user_id !== user?.id).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center">No one else has joined yet</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {event.vibe_soundtrack && (
              <a href={event.vibe_soundtrack} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-primary hover:underline justify-center">
                <Music className="w-3 h-3" /> Session Playlist
              </a>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
