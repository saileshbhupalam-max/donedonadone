import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { PersonalityLoader } from "@/components/ui/PersonalityLoader";
import { ArrowLeft, CalendarIcon, MapPin, Clock, ExternalLink, Share2, MessageCircle, Hand, Timer, Copy, Bookmark, ShieldAlert, KeyRound } from "lucide-react";
import { AddToCalendarButton } from "@/components/session/AddToCalendarButton";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { usePageTitle } from "@/hooks/usePageTitle";
import { getInitials } from "@/lib/utils";
import { WhatsAppShareButton, CopyLinkButton } from "@/components/sharing/WhatsAppButton";
import { RsvpSharePrompt } from "@/components/sharing/RsvpSharePrompt";
import { getEventShareMessage } from "@/lib/sharing";
import { joinWaitlist, getPopularityLabel, updateReliability, promoteWaitlist } from "@/lib/antifragile";
import { ERROR_STATES, CONFIRMATIONS } from "@/lib/personality";
import { trackAnalyticsEvent } from "@/lib/growth";
import { GroupReveal } from "@/components/session/GroupReveal";
import { YourTableCard } from "@/components/session/YourTableCard";
import { VenueVibeSummary } from "@/components/session/VenueVibeRating";
import { VenueIntelligencePanel } from "@/components/venue/VenueQuickBadges";
import { Input } from "@/components/ui/input";
import { FirstSessionGuide } from "@/components/session/FirstSessionGuide";

/* DESIGN: IntentionAtRsvp moves intention-setting to RSVP time.
   Users arrive with purpose already set, not fumbling during the session. */
function IntentionAtRsvp({ eventId, userId }: { eventId: string; userId: string }) {
  const [intention, setIntention] = useState("");
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  const placeholders = [
    "Ship the landing page", "Write 2000 words", "Review 3 pull requests",
    "Finish the pitch deck", "Design the onboarding flow", "Outline the blog post",
  ];
  const [placeholder] = useState(() => placeholders[Math.floor(Math.random() * placeholders.length)]);

  useEffect(() => {
    supabase.from("session_intentions").select("intention")
      .eq("event_id", eventId).eq("user_id", userId).maybeSingle()
      .then(({ data }) => {
        if (data?.intention) { setIntention(data.intention); setSaved(true); }
        setLoading(false);
      });
  }, [eventId, userId]);

  const save = async () => {
    if (!intention.trim()) return;
    await supabase.from("session_intentions").upsert({
      user_id: userId, event_id: eventId, intention: intention.trim(),
    }, { onConflict: "user_id,event_id" });
    setSaved(true);
    setEditing(false);
    toast.success("Intention locked in! 🎯");
  };

  if (loading) return null;

  if (saved && !editing) {
    return (
      <Card className="border-primary/10">
        <CardContent className="p-3 flex items-center gap-2">
          <span>🎯</span>
          <p className="text-sm text-foreground flex-1 italic">"{intention}"</p>
          <button onClick={() => setEditing(true)} className="text-xs text-primary hover:underline">Edit</button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-2">
        <p className="text-sm font-medium text-foreground">🎯 What's your focus for this session?</p>
        <Input value={intention} onChange={e => setIntention(e.target.value.slice(0, 140))}
          placeholder={placeholder} maxLength={140} />
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">People who set intentions accomplish 2x more</p>
          <Button size="sm" onClick={save} disabled={!intention.trim()}>Lock in</Button>
        </div>
      </CardContent>
    </Card>
  );
}

type Profile = Tables<"profiles">;

/* DESIGN: BuddyCard shows first-timers their assigned welcome buddy */
function BuddyCard({ eventId, userId }: { eventId: string; userId: string }) {
  const [buddy, setBuddy] = useState<Profile | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: rsvp } = await supabase
        .from("event_rsvps").select("buddy_user_id")
        .eq("event_id", eventId).eq("user_id", userId).maybeSingle();
      if (rsvp?.buddy_user_id) {
        const { data: prof } = await supabase.from("profiles").select("*").eq("id", rsvp.buddy_user_id).single();
        if (prof) setBuddy(prof);
      }
    })();
  }, [eventId, userId]);

  if (!buddy) return null;

  return (
    <Card className="border-secondary/20 bg-secondary/5">
      <CardContent className="p-4 space-y-3">
        <p className="font-serif text-sm text-foreground">Your Welcome Buddy</p>
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/profile/${buddy.id}`)}>
          <Avatar className="w-10 h-10">
            <AvatarImage src={buddy.avatar_url || ""} />
            <AvatarFallback className="text-xs bg-muted">{getInitials(buddy.display_name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-foreground">{buddy.display_name}</p>
            <p className="text-xs text-muted-foreground">{buddy.tagline || `${buddy.events_attended || 0} sessions attended`}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">They'll say hi when you arrive. You're not walking in alone. 💛</p>
      </CardContent>
    </Card>
  );
}

interface EventRsvp {
  id: string; event_id: string; user_id: string; status: string; created_at: string | null; profile?: Profile;
}

interface EventDetail {
  id: string; title: string; description: string | null; date: string; start_time: string | null;
  end_time: string | null; venue_name: string | null; venue_address: string | null;
  neighborhood: string | null; whatsapp_group_link: string | null; max_spots: number | null;
  women_only: boolean | null; created_by: string | null; rsvp_count: number | null;
  created_at: string | null; session_format: string | null; checkin_pin: string | null;
  creator?: Profile; rsvps: EventRsvp[];
}

const NEIGHBORHOODS: Record<string, string> = {
  hsr_layout: "HSR Layout", koramangala: "Koramangala", indiranagar: "Indiranagar",
  jayanagar: "Jayanagar", whitefield: "Whitefield", electronic_city: "Electronic City",
};

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile: myProfile } = useAuth();
  const [showRsvpShare, setShowRsvpShare] = useState(false);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [userWaitlistPos, setUserWaitlistPos] = useState<number | null>(null);
  usePageTitle(event ? `${event.title} — FocusClub` : "Session — FocusClub");

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: eventData } = await supabase.from("events").select("*").eq("id", id).single();
      if (!eventData) { setNotFound(true); setLoading(false); return; }

      const { data: rsvps } = await supabase.from("event_rsvps").select("*").eq("event_id", id);
      const profileIds = new Set<string>();
      if (eventData.created_by) profileIds.add(eventData.created_by);
      rsvps?.forEach((r) => profileIds.add(r.user_id));

      const { data: profiles } = profileIds.size > 0
        ? await supabase.from("profiles").select("*").in("id", Array.from(profileIds))
        : { data: [] as Profile[] };

      const profileMap = new Map<string, Profile>();
      profiles?.forEach((p) => profileMap.set(p.id, p));

      setEvent({
        ...eventData,
        checkin_pin: (eventData as any).checkin_pin ?? null,
        creator: eventData.created_by ? profileMap.get(eventData.created_by) : undefined,
        rsvps: (rsvps || []).map((r) => ({ ...r, profile: profileMap.get(r.user_id) })),
      } as EventDetail);

      const { data: wl } = await supabase.from("session_waitlist").select("*").eq("event_id", id).is("promoted_at", null).order("position");
      setWaitlistCount((wl || []).length);
      if (user) {
        const myWl = (wl || []).find((w: any) => w.user_id === user.id);
        if (myWl) setUserWaitlistPos(myWl.position);
      }

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const today = new Date().toISOString().split("T")[0];
  const isPast = event ? event.date < today : false;
  const isToday = event ? event.date === today : false;
  const goingList = event?.rsvps.filter((r) => r.status === "going") || [];
  const userRsvp = event?.rsvps.find((r) => r.user_id === user?.id);
  const isStructured = event && event.session_format && event.session_format !== "casual";
  const canJoinSession = isToday && userRsvp?.status === "going" && isStructured;

  /* DESIGN: Only "going" status — removed "interested" to reduce decision friction */
  const isWomenOnly = !!event?.women_only;
  const userGender = myProfile?.gender?.toLowerCase() || "";
  const isWoman = userGender === "woman" || userGender === "female";
  const blockedByWomenOnly = isWomenOnly && !isWoman;

  const handleRsvp = async (status: "going") => {
    if (!user || !event) return;
    if (blockedByWomenOnly) {
      toast.error("This is a women-only session. Only women can RSVP.");
      return;
    }
    const existing = userRsvp;

    setEvent((prev) => {
      if (!prev) return prev;
      let newRsvps = [...prev.rsvps];
      if (existing?.status === status) {
        newRsvps = newRsvps.filter((r) => r.user_id !== user.id);
      } else if (existing) {
        newRsvps = newRsvps.map((r) => r.user_id === user.id ? { ...r, status } : r);
      } else {
        newRsvps.push({ id: crypto.randomUUID(), event_id: prev.id, user_id: user.id, status, created_at: new Date().toISOString() });
      }
      return { ...prev, rsvps: newRsvps };
    });

    if (existing?.status === status) {
      await supabase.from("event_rsvps").delete().eq("event_id", event.id).eq("user_id", user.id);
      setShowRsvpShare(false);
      if (status === "going") promoteWaitlist(event.id).catch(() => {});
      trackAnalyticsEvent('rsvp_cancel', user.id, { event_id: event.id }).catch(() => {});
    } else if (existing) {
      await supabase.from("event_rsvps").update({ status }).eq("event_id", event.id).eq("user_id", user.id);
      if (status === "going") {
        setShowRsvpShare(true);
        updateReliability(user.id, 'rsvp').catch(() => {});
        trackAnalyticsEvent('rsvp', user.id, { event_id: event.id }).catch(() => {});
      }
    } else {
      await supabase.from("event_rsvps").insert({ event_id: event.id, user_id: user.id, status });
      if (status === "going") {
        setShowRsvpShare(true);
        toast.success(CONFIRMATIONS.rsvpSuccess(format(parseISO(event.date), "EEEE"), event.venue_name));
        updateReliability(user.id, 'rsvp').catch(() => {});
        trackAnalyticsEvent('rsvp', user.id, { event_id: event.id }).catch(() => {});

        // Auto-match buddy for first-timers
        if ((myProfile?.events_attended || 0) === 0) {
          (async () => {
            try {
              await supabase.from("event_rsvps").update({ is_first_session: true })
                .eq("event_id", event.id).eq("user_id", user.id);
              const { data: buddyCandidates } = await supabase.from("event_rsvps")
                .select("user_id, profiles!inner(display_name, events_attended, is_welcome_buddy)")
                .eq("event_id", event.id).eq("status", "going").neq("user_id", user.id)
                .eq("profiles.is_welcome_buddy", true)
                .gte("profiles.events_attended", 5).limit(1);
              if (buddyCandidates && buddyCandidates.length > 0) {
                const buddy = buddyCandidates[0];
                await supabase.from("event_rsvps").update({ buddy_user_id: buddy.user_id })
                  .eq("event_id", event.id).eq("user_id", user.id);
                await supabase.rpc("create_system_notification", {
                  p_user_id: buddy.user_id,
                  p_title: "Welcome Buddy Request",
                  p_body: `${myProfile?.display_name || "Someone"} is coming to their first session! Say hi when they arrive.`,
                  p_type: "buddy",
                });
              }
            } catch (e) {
              console.error("[buddy-match]", e);
            }
          })();
        }
      }
    }
  };

  const handleShare = () => {
    if (!event) return;
    const msg = getEventShareMessage(event, goingList.length, myProfile?.referral_code);
    navigator.clipboard.writeText(msg);
    toast.success("Copied to clipboard!");
  };

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const eventUrl = event ? `${appUrl}/events/${event.id}${myProfile?.referral_code ? `?ref=${myProfile.referral_code}` : ""}` : "";
  const whatsAppMsg = event ? getEventShareMessage(event, goingList.length, myProfile?.referral_code) : "";

  if (loading) return (
    <AppShell><div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
      <PersonalityLoader /><Skeleton className="h-8 w-32" /><Skeleton className="h-48" /><Skeleton className="h-32" />
    </div></AppShell>
  );

  if (notFound || !event) return (
    <AppShell><div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] text-center px-4">
      <p className="font-serif text-2xl text-foreground mb-2">Session not found</p>
      <p className="text-muted-foreground mb-4">This session doesn't exist or you don't have access.</p>
      <Button variant="outline" onClick={() => navigate("/events")}>Back to Sessions</Button>
    </div></AppShell>
  );

  return (
    <AppShell>
      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {isPast && <Badge variant="outline" className="text-muted-foreground">That ship has sailed, that session has sessioned.</Badge>}

        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-serif text-2xl text-foreground">{event.title}</h1>
            {event.women_only && <Badge className="bg-secondary/20 text-secondary border-0">👩 Women Only</Badge>}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarIcon className="w-4 h-4" /><span>{format(parseISO(event.date), "EEEE, MMMM d, yyyy")}</span>
          </div>
          {(event.start_time || event.end_time) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" /><span>{event.start_time}{event.end_time ? ` - ${event.end_time}` : ""}</span>
            </div>
          )}
          {event.venue_name && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4" /><span>{event.venue_name}{event.neighborhood ? ` · ${NEIGHBORHOODS[event.neighborhood] || event.neighborhood}` : ""}</span>
            </div>
          )}
          {event.venue_address && (
            <a href={`https://maps.google.com/?q=${encodeURIComponent(event.venue_address)}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              <ExternalLink className="w-3 h-3" /> Open in Maps
            </a>
          )}
        </div>

        {/* Venue intelligence — detailed ratings breakdown */}
        {event.venue_name && (
          <VenueIntelligencePanel
            venueName={event.venue_name}
            eventId={event.id}
            userId={user?.id}
            hasAttended={isPast && userRsvp?.status === "going"}
          />
        )}

        {event.creator && (
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate(`/profile/${event.creator!.id}`)}>
            <Avatar className="w-8 h-8">
              <AvatarImage src={event.creator.avatar_url || ""} />
              <AvatarFallback className="text-xs bg-muted">{getInitials(event.creator.display_name)}</AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">Created by <span className="font-medium text-foreground">{event.creator.display_name}</span></span>
          </div>
        )}

        {!isPast && (
          <Card>
            <CardContent className="p-4 space-y-3">
              {event.max_spots && (
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{goingList.length} of {event.max_spots} spots</span>
                    {goingList.length >= event.max_spots && <span className="text-destructive font-medium">Full</span>}
                  </div>
                  <Progress value={(goingList.length / event.max_spots) * 100} className="h-2" />
                  {(() => {
                    const label = getPopularityLabel(goingList.length, event.max_spots, waitlistCount);
                    return label ? <p className="text-xs text-muted-foreground">{label}</p> : null;
                  })()}
                </div>
              )}

              {userWaitlistPos && <Badge variant="outline" className="text-xs">You're #{userWaitlistPos} on the waitlist</Badge>}

              {blockedByWomenOnly && userRsvp?.status !== "going" ? (
                <div className="flex items-center gap-2 rounded-md bg-secondary/10 border border-secondary/20 px-3 py-2">
                  <ShieldAlert className="w-4 h-4 text-secondary shrink-0" />
                  <span className="text-sm text-muted-foreground">This is a women-only session</span>
                </div>
              ) : (
              <div className="flex gap-2">
                {event.max_spots && goingList.length >= event.max_spots && userRsvp?.status !== "going" && !userWaitlistPos ? (
                  <Button className="flex-1" variant="outline" onClick={async () => {
                    if (!user) return;
                    const pos = await joinWaitlist(event.id, user.id);
                    setUserWaitlistPos(pos);
                    setWaitlistCount(prev => prev + 1);
                    toast.success(`You're #${pos} on the waitlist`);
                  }}>Join Waitlist</Button>
                ) : userRsvp?.status === "going" ? (
                  <Button className="flex-1" variant="outline" onClick={() => handleRsvp("going")}>
                    <Hand className="w-4 h-4" /> Going ✓
                  </Button>
                ) : (
                  <Button className="flex-1" variant={userRsvp?.status === "going" ? "default" : "outline"}
                    onClick={() => handleRsvp("going")}
                    disabled={!!event.max_spots && goingList.length >= event.max_spots}>
                    <Hand className="w-4 h-4" /> RSVP
                  </Button>
                )}
              </div>
              )}
            </CardContent>
          </Card>
        )}

        {userRsvp?.status === "going" && !isPast && <IntentionAtRsvp eventId={event.id} userId={user?.id || ""} />}

        {userRsvp?.status === "going" && !isPast && (
          <AddToCalendarButton event={{ title: event.title, date: event.date, startTime: event.start_time, endTime: event.end_time, venueName: event.venue_name, venueAddress: event.venue_address }} className="w-full" />
        )}

        {showRsvpShare && event && (
          <RsvpSharePrompt eventTitle={event.title} eventDate={format(parseISO(event.date), "MMM d")} venueName={event.venue_name} eventId={event.id} referralCode={myProfile?.referral_code} />
        )}

        {userRsvp?.status === "going" && !isPast && user && <YourTableCard eventId={event.id} userId={user.id} eventDate={event.date} />}

        {userRsvp?.status === "going" && !isPast && user && <GroupReveal eventId={event.id} userId={user.id} />}

        {userRsvp?.status === "going" && !isPast && (myProfile?.events_attended || 0) === 0 && (
          <BuddyCard eventId={event.id} userId={user?.id || ""} />
        )}

        {userRsvp?.status === "going" && !isPast && (myProfile?.events_attended || 0) === 0 && (
          <FirstSessionGuide />
        )}

        {event.description && (
          <Card><CardContent className="p-4"><p className="text-sm text-foreground whitespace-pre-wrap">{event.description}</p></CardContent></Card>
        )}

        {/* Attendees — going only */}
        {goingList.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <h3 className="font-medium text-sm text-foreground mb-2">Going ({goingList.length})</h3>
                <div className="grid grid-cols-4 gap-3">
                  {goingList.map((r) => (
                    <div key={r.id} className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => navigate(`/profile/${r.user_id}`)}>
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={r.profile?.avatar_url || ""} />
                        <AvatarFallback className="text-xs bg-muted">{getInitials(r.profile?.display_name)}</AvatarFallback>
                      </Avatar>
                      <span className="text-[11px] text-muted-foreground text-center truncate w-full">{r.profile?.display_name || "Member"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <EventMemories eventId={event.id} />

        {isToday && userRsvp?.status === "going" && event.checkin_pin && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 px-1">
            <KeyRound className="w-3.5 h-3.5" /> Check-in PIN: <span className="font-mono font-medium text-foreground">{event.checkin_pin}</span> <span className="text-muted-foreground/70">(use if location check-in doesn't work)</span>
          </p>
        )}

        {canJoinSession && (
          <Button className="mx-0 w-full gap-2" onClick={() => navigate(`/session/${event.id}`)}>
            <Timer className="w-4 h-4" /> Join Session →
          </Button>
        )}

        <div className="flex gap-2">
          {event.whatsapp_group_link && (
            <Button asChild className="flex-1" style={{ backgroundColor: "#25D366" }}>
              <a href={event.whatsapp_group_link} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-4 h-4" /> WhatsApp Group
              </a>
            </Button>
          )}
          <WhatsAppShareButton message={whatsAppMsg} label="Share" className="flex-1" />
          <CopyLinkButton link={eventUrl} label="" size="icon" />
        </div>
      </div>
    </AppShell>
  );
}

function EventMemories({ eventId }: { eventId: string }) {
  const [photos, setPhotos] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("session_photos").select("*").eq("event_id", eventId).order("created_at", { ascending: false })
      .then(({ data }: any) => setPhotos(data || []));
  }, [eventId]);

  if (photos.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h3 className="font-medium text-sm text-foreground">📸 Memories ({photos.length})</h3>
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p: any) => (
            <a key={p.id} href={p.photo_url} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-lg overflow-hidden bg-muted">
              <img src={p.photo_url} alt="Session memory" className="w-full h-full object-cover" loading="lazy" />
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
