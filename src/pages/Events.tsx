import { ERROR_STATES, CONFIRMATIONS } from "@/lib/personality";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { hapticLight } from "@/lib/haptics";
import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { getInitials } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { useEvents, Event as EventType } from "@/hooks/useEvents";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { PersonalityLoader } from "@/components/ui/PersonalityLoader";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CalendarIcon, Plus, MapPin, Hand, AlertTriangle, Send, Map, List, Bookmark } from "lucide-react";
import { format, parseISO, isTomorrow, differenceInDays, differenceInHours } from "date-fns";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePageTitle } from "@/hooks/usePageTitle";
import { calculateSessionHours, addFocusHours } from "@/lib/ranks";
import { createSessionPhases, getFormatPhases, getFormatLabel } from "@/lib/sessionPhases";
import { GivePropsFlow } from "@/components/session/GivePropsFlow";
import { VenueReviewCard } from "@/components/venue/VenueReviewCard";
import { VenueVibeSummary } from "@/components/session/VenueVibeRating";
import { motion } from "framer-motion";

const SessionMap = lazy(() => import("@/components/map/SessionMap").then(m => ({ default: m.SessionMap })));

// Neighborhoods, days, labels, and helper functions
const NEIGHBORHOODS = [
  { value: "hsr_layout", label: "HSR Layout" },
  { value: "koramangala", label: "Koramangala" },
  { value: "indiranagar", label: "Indiranagar" },
  { value: "jayanagar", label: "Jayanagar" },
  { value: "whitefield", label: "Whitefield" },
  { value: "electronic_city", label: "Electronic City" },
];

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS: Record<string, string> = { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun" };

function getNeighborhoodLabel(value: string | null) {
  return NEIGHBORHOODS.find((n) => n.value === value)?.label || value || "";
}

function getTimingLabel(dateStr: string) {
  const date = parseISO(dateStr);
  if (isTomorrow(date)) return "Tomorrow!";
  const days = differenceInDays(date, new Date());
  if (days === 0) return "Today!";
  if (days > 0 && days <= 7) return `In ${days} day${days > 1 ? "s" : ""}`;
  if (days > 7) return format(date, "EEE, MMM d");
  return null;
}

function isWithin48Hours(dateStr: string) {
  const eventDate = parseISO(dateStr);
  const hours = differenceInHours(eventDate, new Date());
  return hours >= 0 && hours <= 48;
}

// ─── Event Card ──────────────────────
/* DESIGN: "Interested" removed — binary RSVP reduces decision friction.
   Circle social proof shows who from your network is going. */
function EventCard({ event, onRsvp, userRsvp, isPast, allUpcoming, minThreshold, isRestricted, circleUserIds }: {
  event: EventType;
  onRsvp: (id: string, status: "going") => void;
  userRsvp: { status: string } | null;
  isPast: boolean;
  allUpcoming: EventType[];
  minThreshold: number;
  isRestricted?: boolean;
  circleUserIds?: string[];
}) {
  const navigate = useNavigate();
  const goingCount = event.rsvps?.filter((r) => r.status === "going").length || 0;
  const goingAvatars = event.rsvps?.filter((r) => r.status === "going").slice(0, 5) || [];
  const timingLabel = !isPast ? getTimingLabel(event.date) : null;
  const isLowAttendance = !isPast && isWithin48Hours(event.date) && goingCount < minThreshold;

  // Circle members going to this event
  const circleGoing = circleUserIds && circleUserIds.length > 0
    ? (event.rsvps || []).filter(r => r.status === "going" && circleUserIds.includes(r.user_id))
    : [];

  const nearbySessions = isLowAttendance ? allUpcoming.filter((e) =>
    e.id !== event.id &&
    (e.neighborhood === event.neighborhood || !event.neighborhood) &&
    (e.rsvps?.filter((r) => r.status === "going").length || 0) > goingCount
  ).slice(0, 3) : [];

  return (
    <Card className={cn("cursor-pointer hover:shadow-md transition-shadow", isLowAttendance && "border-destructive/30")}
      onClick={() => navigate(`/events/${event.id}`)}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-serif text-lg text-foreground">{event.title}</h3>
              {event.women_only && <Badge className="bg-secondary/20 text-secondary border-0 text-xs">👩 Women Only</Badge>}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>
                {format(parseISO(event.date), "EEE, MMM d")}
                {event.start_time && ` · ${event.start_time}`}
                {event.end_time && ` - ${event.end_time}`}
              </span>
            </div>
            {event.venue_name && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" />
                <span>{event.venue_name}{event.neighborhood ? ` · ${getNeighborhoodLabel(event.neighborhood)}` : ""}</span>
              </div>
            )}
          </div>
          {timingLabel && (
            <Badge variant="outline" className="text-xs shrink-0 border-primary/30 text-primary">{timingLabel}</Badge>
          )}
        </div>

        {event.description && <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>}

        {/* Venue vibe summary */}
        {event.venue_name && <VenueVibeSummary venueName={event.venue_name} />}

        {event.max_spots && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{goingCount} of {event.max_spots} spots</span>
              {goingCount >= event.max_spots && <span className="text-destructive font-medium">Full</span>}
            </div>
            <Progress value={(goingCount / event.max_spots) * 100} className="h-1.5" />
          </div>
        )}

        {isLowAttendance && (
          <div className="bg-destructive/10 rounded-lg p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>This session needs more people — invite a friend or check nearby sessions</span>
            </div>
            {nearbySessions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {nearbySessions.map((ns) => (
                  <button key={ns.id} onClick={() => navigate(`/events/${ns.id}`)}
                    className="text-[11px] bg-background border border-border rounded-full px-2.5 py-1 hover:bg-muted transition-colors">
                    {ns.title} · {ns.rsvps?.filter((r) => r.status === "going").length || 0} going
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {goingAvatars.length > 0 && (
              <div className="flex -space-x-2">
                {goingAvatars.map((r) => (
                  <Avatar key={r.id} className="w-7 h-7 border-2 border-background">
                    <AvatarImage src={r.profile?.avatar_url || ""} />
                    <AvatarFallback className="text-[10px] bg-muted">{getInitials(r.profile?.display_name)}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
            )}
            <span className="text-xs text-muted-foreground">{goingCount} going</span>
          </div>
          <button onClick={(e) => { e.stopPropagation(); navigate(`/map?event=${event.id}`); }}
            className="text-[10px] text-primary flex items-center gap-0.5 hover:underline">
            <Map className="w-3 h-3" /> Map
          </button>
        </div>

        {/* DESIGN: Social proof — circle members going creates warm FOMO */}
        {circleGoing.length > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-primary">
            <div className="flex -space-x-1">
              {circleGoing.slice(0, 3).map(r => (
                <Avatar key={r.id} className="w-5 h-5 border border-background">
                  <AvatarImage src={r.profile?.avatar_url || ""} />
                  <AvatarFallback className="text-[8px] bg-primary/10">{getInitials(r.profile?.display_name)}</AvatarFallback>
                </Avatar>
              ))}
            </div>
            <span>
              {circleGoing[0]?.profile?.display_name?.split(" ")[0]}
              {circleGoing.length > 1 ? ` + ${circleGoing.length - 1} from your circle` : " from your circle"} going
            </span>
          </div>
        )}

        {!isPast && (
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            {userRsvp?.status === "going" ? (
              <Button size="sm" variant="default" className="flex-1 bg-primary"
                onClick={() => onRsvp(event.id, "going")}>
                <Hand className="w-3.5 h-3.5" /> Going ✓
              </Button>
            ) : event.max_spots && goingCount >= event.max_spots ? (
              <Button size="sm" variant="outline" className="flex-1"
                onClick={() => onRsvp(event.id, "going")}
                disabled={isRestricted}>
                Join Waitlist
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="flex-1"
                onClick={() => onRsvp(event.id, "going")}
                disabled={isRestricted}>
                <Hand className="w-3.5 h-3.5" /> RSVP
              </Button>
            )}
          </div>
        )}

        {isPast && <Badge variant="outline" className="text-xs text-muted-foreground">Session complete</Badge>}
      </CardContent>
    </Card>
  );
}

// ─── Create Event Button with Host Eligibility ──────────
function CreateEventButton({ onCreated }: { onCreated: () => void }) {
  const { profile, user } = useAuth();
  const { createEvent } = useEvents();
  const [open, setOpen] = useState(false);
  const [eligibleOpen, setEligibleOpen] = useState(false);
  const [hostCount, setHostCount] = useState(0);
  const [hostThreshold, setHostThreshold] = useState(10);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date>();
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [maxSpots, setMaxSpots] = useState("");
  const [whatsappLink, setWhatsappLink] = useState("");
  const [womenOnly, setWomenOnly] = useState(false);
  const [sessionFormat, setSessionFormat] = useState("casual");
  const [vibeSoundtrack, setVibeSoundtrack] = useState("");
  const [venuePartnerId, setVenuePartnerId] = useState("");
  const [venuePartners, setVenuePartners] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from("venue_partners").select("id, venue_name, venue_address, neighborhood, latitude, longitude").eq("status", "active")
      .then(({ data }) => setVenuePartners(data || []));
  }, []);

  const checkEligibility = async () => {
    if (!user) return;
    const [{ count }, { data: setting }] = await Promise.all([
      supabase.from("event_rsvps").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "going"),
      supabase.from("app_settings").select("value").eq("key", "min_event_attendance_to_host").single(),
    ]);
    const threshold = (setting?.value as Record<string, unknown>)?.value as number || 10;
    const c = count || 0;
    setHostCount(c);
    setHostThreshold(threshold);
    if (c >= threshold) setOpen(true);
    else setEligibleOpen(true);
  };

  const handleSubmit = async () => {
    if (!title || !date) return;
    setSubmitting(true);
    const { data, error } = await createEvent({
      title, description: description || undefined, date: format(date, "yyyy-MM-dd"),
      start_time: startTime || undefined, end_time: endTime || undefined,
      venue_name: venueName || undefined, venue_address: venueAddress || undefined,
      neighborhood: neighborhood || undefined, max_spots: maxSpots ? parseInt(maxSpots) : null,
      whatsapp_group_link: whatsappLink || undefined, women_only: womenOnly,
    }) || {};
    setSubmitting(false);
    if (!error && data) {
      const updates: any = {};
      if (sessionFormat !== "casual") {
        updates.session_format = sessionFormat;
        updates.vibe_soundtrack = vibeSoundtrack || null;
      }
      if (venuePartnerId && venuePartnerId !== "none") {
        updates.venue_partner_id = venuePartnerId;
        const selectedVp = venuePartners.find((vp: any) => vp.id === venuePartnerId);
        if (selectedVp?.latitude && selectedVp?.longitude) {
          updates.venue_latitude = selectedVp.latitude;
          updates.venue_longitude = selectedVp.longitude;
        }
      }
      updates.checkin_pin = String(Math.floor(1000 + Math.random() * 9000));
      if (Object.keys(updates).length > 0) {
        await supabase.from("events").update(updates).eq("id", data.id);
      }
      if (sessionFormat !== "casual") {
        await createSessionPhases(data.id, sessionFormat);
      }
      toast.success("Session created! 🎉");
      setOpen(false);
      setTitle(""); setDescription(""); setDate(undefined); setStartTime(""); setEndTime("");
      setVenueName(""); setVenueAddress(""); setNeighborhood(""); setMaxSpots(""); setWhatsappLink(""); setWomenOnly(false);
      setSessionFormat("casual"); setVibeSoundtrack(""); setVenuePartnerId("");
      onCreated();
    } else if (error) toast.error(ERROR_STATES.generic);
  };

  return (
    <>
      <Button size="icon" className="fixed z-40 rounded-full w-14 h-14 shadow-lg bg-primary hover:bg-primary/90 right-4" style={{ bottom: "calc(5rem + env(safe-area-inset-bottom, 0px) + 0.5rem)" }}
        onClick={checkEligibility}>
        <Plus className="w-6 h-6" />
      </Button>

      <Dialog open={eligibleOpen} onOpenChange={setEligibleOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif">Almost there!</DialogTitle></DialogHeader>
          <div className="space-y-4 text-center py-2">
            <p className="text-sm text-muted-foreground">
              You need to attend {hostThreshold - hostCount} more event{hostThreshold - hostCount !== 1 ? "s" : ""} before you can host. Keep showing up!
            </p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground"><span>{hostCount} attended</span><span>{hostThreshold} needed</span></div>
              <Progress value={(hostCount / hostThreshold) * 100} className="h-2" />
            </div>
            <Button variant="outline" onClick={() => setEligibleOpen(false)}>Got it</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif">Create Session</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Deep Focus Saturday" /></div>
            <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this session about?" rows={3} /></div>
            <div>
              <Label>Date *</Label>
              <Popover><PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left", !date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />{date ? format(date, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={date} onSelect={setDate} disabled={(d) => d < new Date()} className="p-3 pointer-events-auto" />
              </PopoverContent></Popover>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start Time</Label><Input value={startTime} onChange={(e) => setStartTime(e.target.value)} placeholder="10:00 AM" /></div>
              <div><Label>End Time</Label><Input value={endTime} onChange={(e) => setEndTime(e.target.value)} placeholder="1:00 PM" /></div>
            </div>
            <div><Label>Venue Name</Label><Input value={venueName} onChange={(e) => setVenueName(e.target.value)} placeholder="Third Wave Coffee" /></div>
            {venuePartners.length > 0 && (
              <div>
                <Label>Link to Partner Venue</Label>
                <Select value={venuePartnerId} onValueChange={(v) => {
                  setVenuePartnerId(v);
                  const vp = venuePartners.find((p: any) => p.id === v);
                  if (vp) { setVenueName(vp.venue_name); setVenueAddress(vp.venue_address || ""); setNeighborhood(vp.neighborhood || ""); }
                }}>
                  <SelectTrigger><SelectValue placeholder="Select partner venue" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No partner venue</SelectItem>
                    {venuePartners.map((vp: any) => <SelectItem key={vp.id} value={vp.id}>{vp.venue_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Venue Address</Label><Input value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} placeholder="27th Main, HSR Layout" /></div>
            <div>
              <Label>Neighborhood</Label>
              <Select value={neighborhood} onValueChange={setNeighborhood}>
                <SelectTrigger><SelectValue placeholder="Select neighborhood" /></SelectTrigger>
                <SelectContent>{NEIGHBORHOODS.map((n) => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Max Spots (optional)</Label><Input type="number" value={maxSpots} onChange={(e) => setMaxSpots(e.target.value)} placeholder="Leave empty for unlimited" /></div>
            <div>
              <Label>Session Format</Label>
              <Select value={sessionFormat} onValueChange={setSessionFormat}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="casual">☕ Casual</SelectItem>
                  <SelectItem value="structured_2hr">⏱️ Structured 2hr</SelectItem>
                  <SelectItem value="structured_4hr">⏱️ Structured 4hr</SelectItem>
                </SelectContent>
              </Select>
              {sessionFormat !== "casual" && (
                <div className="mt-2 space-y-1 bg-muted/50 rounded-lg p-3">
                  {getFormatPhases(sessionFormat).map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{p.phase_label}</span>
                      <span className="text-[10px]">({p.duration_minutes}min)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {sessionFormat !== "casual" && (
              <div><Label>Vibe Soundtrack URL (optional)</Label><Input value={vibeSoundtrack} onChange={(e) => setVibeSoundtrack(e.target.value)} placeholder="Spotify or YouTube link" /></div>
            )}
            <div><Label>WhatsApp Group Link (optional)</Label><Input value={whatsappLink} onChange={(e) => setWhatsappLink(e.target.value)} placeholder="https://chat.whatsapp.com/..." /></div>
            {profile?.gender === "woman" && (
              <div className="flex items-center gap-3"><Switch checked={womenOnly} onCheckedChange={setWomenOnly} /><Label>Women-only session</Label></div>
            )}
            <Button className="w-full" onClick={handleSubmit} disabled={!title || !date || submitting}>{submitting ? "Creating..." : "Create Session"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Post-Event Feedback Card ──────────────────────────
function FeedbackCard({ event, userId, onDismiss }: { event: any; userId: string; onDismiss: () => void }) {
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showProps, setShowProps] = useState(false);
  const [showVenueReview, setShowVenueReview] = useState(false);
  const [venuePartnerInfo, setVenuePartnerInfo] = useState<{ id: string; venue_name: string } | null>(null);
  const [feedbackEventId, setFeedbackEventId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("events").select("venue_partner_id").eq("id", event.id).single()
      .then(({ data }: any) => {
        if (data?.venue_partner_id) {
          supabase.from("venue_partners").select("id, venue_name").eq("id", data.venue_partner_id).single()
            .then(({ data: vp }: any) => { if (vp) setVenuePartnerInfo(vp); });
        }
      });
  }, [event.id]);

  const EMOJIS = [
    { value: 1, emoji: "😞" }, { value: 2, emoji: "😐" }, { value: 3, emoji: "🙂" },
    { value: 4, emoji: "😊" }, { value: 5, emoji: "🤩" },
  ];

  const submitFeedback = async (rating: number, attended: boolean = true) => {
    try {
      const { error } = await supabase.from("event_feedback").insert({
        event_id: event.id, user_id: userId, rating: attended ? rating : null, comment: comment || null, attended,
      });
      if (error) throw error;
      if (attended) {
        const { data: prof } = await supabase.from("profiles").select("events_attended").eq("id", userId).single();
        await supabase.from("profiles").update({ events_attended: (prof?.events_attended || 0) + 1 }).eq("id", userId);
        const hours = calculateSessionHours(event.start_time, event.end_time, event.title);
        await addFocusHours(userId, hours);
        setFeedbackEventId(event.id);
        setShowProps(true);
        setSubmitted(true);
      } else {
        const { data: prof } = await supabase.from("profiles").select("events_no_show").eq("id", userId).single();
        await supabase.from("profiles").update({ events_no_show: (prof?.events_no_show || 0) + 1 }).eq("id", userId);
        setSubmitted(true);
        toast.success(CONFIRMATIONS.rsvpCancelled);
        setTimeout(onDismiss, 1500);
      }
    } catch (error) {
      console.error("[EventFeedback]", error);
      toast.error(ERROR_STATES.generic);
    }
  };

  const handlePropsDone = () => {
    if (venuePartnerInfo) { setShowProps(false); setShowVenueReview(true); }
    else onDismiss();
  };

  if (showVenueReview && venuePartnerInfo) {
    return <VenueReviewCard venuePartnerId={venuePartnerInfo.id} venueName={venuePartnerInfo.venue_name} eventId={event.id} userId={userId} onDone={onDismiss} />;
  }
  if (showProps && feedbackEventId) return <GivePropsFlow eventId={feedbackEventId} onDone={handlePropsDone} />;
  if (submitted) return null;

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-3">
        <p className="text-sm font-medium text-foreground">How was {event.title}?</p>
        <div className="flex justify-center gap-3">
          {EMOJIS.map((e) => (
            <button key={e.value} onClick={() => submitFeedback(e.value)} className="text-2xl hover:scale-125 transition-transform p-1">{e.emoji}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <Textarea value={comment} onChange={(e) => setComment(e.target.value.slice(0, 200))} placeholder="Any feedback? (optional)" rows={2} className="flex-1" />
        </div>
        <button onClick={() => submitFeedback(0, false)} className="text-xs text-muted-foreground hover:underline">I didn't attend</button>
      </CardContent>
    </Card>
  );
}

// ─── Session Request Sheet ──────────────────────────────
function SessionRequestSheet() {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [requestType, setRequestType] = useState("general");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [preferredTime, setPreferredTime] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const toggleDay = (day: string) => setSelectedDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);

  const handleSubmit = async () => {
    if (!user || !neighborhood) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("session_requests").insert({
        user_id: user.id, request_type: requestType, preferred_days: selectedDays,
        preferred_time: preferredTime || null, neighborhood, notes: notes || null,
      });
      if (error) throw error;
      toast.success("Session request submitted! 🎉");
      setOpen(false);
      setSelectedDays([]); setPreferredTime(""); setNeighborhood(""); setNotes(""); setRequestType("general");
    } catch (error) {
      console.error("[SessionRequest]", error);
      toast.error(ERROR_STATES.generic);
    } finally { setSubmitting(false); }
  };

  return (
    <Card className="border-dashed">
      <CardContent className="p-4 text-center">
        <p className="text-sm text-muted-foreground mb-2">Can't find a session near you?</p>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild><Button variant="outline" size="sm">Request a Session →</Button></SheetTrigger>
          <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-2xl">
            <SheetHeader><SheetTitle className="font-serif">Request a Session</SheetTitle></SheetHeader>
            <div className="space-y-4 mt-4">
              {profile?.gender === "woman" && (
                <div className="flex items-center gap-3">
                  <Switch checked={requestType === "women_only"} onCheckedChange={(v) => setRequestType(v ? "women_only" : "general")} />
                  <Label>Women-only session</Label>
                </div>
              )}
              <div>
                <Label className="text-sm">Preferred Days</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {DAYS.map((d) => (
                    <button key={d} onClick={() => toggleDay(d)}
                      className={cn("px-3 py-1.5 rounded-full text-xs border transition-all",
                        selectedDays.includes(d) ? "bg-primary text-primary-foreground border-primary" : "border-border text-foreground hover:bg-muted")}>
                      {DAY_LABELS[d]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm">Preferred Time</Label>
                <div className="flex gap-2 mt-2">
                  {["morning", "afternoon", "evening"].map((t) => (
                    <button key={t} onClick={() => setPreferredTime(t)}
                      className={cn("flex-1 px-3 py-2 rounded-xl border text-xs font-medium transition-all capitalize",
                        preferredTime === t ? "border-primary bg-primary/10" : "border-border hover:bg-muted")}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm">Neighborhood *</Label>
                <Select value={neighborhood} onValueChange={setNeighborhood}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select neighborhood" /></SelectTrigger>
                  <SelectContent>{NEIGHBORHOODS.map((n) => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Notes (optional)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any preferences?" rows={2} className="mt-1" />
              </div>
              <Button className="w-full" onClick={handleSubmit} disabled={!neighborhood || submitting}>
                <Send className="w-4 h-4" /> {submitting ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </CardContent>
    </Card>
  );
}

// ─── Main Events Page ──────────────────────────────────
export default function Events() {
  usePageTitle("Sessions — FocusClub");
  const { profile, user } = useAuth();
  const { upcoming, past, loading, toggleRsvp, getUserRsvp, fetchEvents } = useEvents();
  const [filter, setFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [savedEvents, setSavedEvents] = useState<string[]>(() =>
    JSON.parse(localStorage.getItem("fc_saved_events") || "[]")
  );
  const [minThreshold, setMinThreshold] = useState(3);
  const [pendingFeedback, setPendingFeedback] = useState<any[]>([]);
  const [circleUserIds, setCircleUserIds] = useState<string[]>([]);

  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "min_session_threshold").single()
      .then(({ data }) => { if (data?.value) setMinThreshold((data.value as Record<string, unknown>)?.value as number || 3); });
  }, []);

  // Fetch circle members for social proof
  useEffect(() => {
    if (!user) return;
    supabase.rpc("get_my_circle", { p_user_id: user.id })
      .then(({ data }) => {
        if (data) setCircleUserIds(data.map((c: any) => c.circle_user_id));
      });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data: rsvps } = await supabase.from("event_rsvps")
        .select("event_id, events:event_id(id, title, date)")
        .eq("user_id", user.id).eq("status", "going");
      if (!rsvps) return;
      const pastRsvps = rsvps.filter((r: any) => r.events && r.events.date < today);
      if (pastRsvps.length === 0) return;
      const eventIds = pastRsvps.map((r: any) => r.events.id);
      const { data: feedback } = await supabase.from("event_feedback")
        .select("event_id").eq("user_id", user.id).in("event_id", eventIds);
      const feedbackIds = new Set((feedback || []).map((f) => f.event_id));
      const pending = pastRsvps.filter((r: any) => !feedbackIds.has(r.events.id)).map((r: any) => r.events);
      setPendingFeedback(pending.slice(0, 2));
    })();
  }, [user]);

  const allNeighborhoods = [...new Set([...upcoming, ...past].map((e) => e.neighborhood).filter(Boolean))] as string[];

  const filterEvents = (list: EventType[]) => {
    if (filter === "all") return list;
    if (filter === "women_only") return list.filter((e) => e.women_only);
    return list.filter((e) => e.neighborhood === filter);
  };

  return (
    <AppShell>
      <PullToRefresh onRefresh={async () => { await fetchEvents(); }}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
        className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        <h1 className="font-serif text-2xl text-foreground">Sessions</h1>

        <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
          <button onClick={() => setViewMode("list")}
            className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1",
              viewMode === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <List className="w-3.5 h-3.5" /> List
          </button>
          <button onClick={() => setViewMode("map")}
            className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1",
              viewMode === "map" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <MapPin className="w-3.5 h-3.5" /> Map
          </button>
        </div>

        {profile?.reliability_status === 'warning' && (
          <Alert className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200 text-sm">
              Heads up — you've missed recent sessions. One more no-show and your account will be restricted.
            </AlertDescription>
          </Alert>
        )}
        {profile?.reliability_status === 'restricted' && (
          <Alert className="border-destructive/50 bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive text-sm">
              Your account is restricted due to repeated no-shows. Contact us to restore access.
            </AlertDescription>
          </Alert>
        )}

        {user && pendingFeedback.map((ev) => (
          <FeedbackCard key={ev.id} event={ev} userId={user.id} onDismiss={() => setPendingFeedback((p) => p.filter((e) => e.id !== ev.id))} />
        ))}

        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All Sessions</Button>
          {allNeighborhoods.map((n) => (
            <Button key={n} size="sm" variant={filter === n ? "default" : "outline"} onClick={() => setFilter(n)}>{getNeighborhoodLabel(n)}</Button>
          ))}
          {profile?.gender === "woman" && (
            <Button size="sm" variant={filter === "women_only" ? "secondary" : "outline"} onClick={() => setFilter("women_only")}>👩 Women Only</Button>
          )}
        </div>

        {viewMode === "map" ? (
          <Suspense fallback={<Skeleton className="h-[400px] rounded-lg" />}>
            <div className="h-[400px] rounded-lg overflow-hidden"><SessionMap /></div>
          </Suspense>
        ) : (
          <Tabs defaultValue="upcoming">
            <TabsList className="w-full">
              <TabsTrigger value="upcoming" className="flex-1">Upcoming</TabsTrigger>
              <TabsTrigger value="past" className="flex-1">Past</TabsTrigger>
            </TabsList>
            <TabsContent value="upcoming" className="space-y-3 mt-3">
              {loading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-lg" />) :
                filterEvents(upcoming).length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground text-sm">No upcoming sessions</p>
                    <p className="text-xs text-muted-foreground mt-1">Check back soon or request one below</p>
                  </div>
                ) : filterEvents(upcoming).map((e) => (
                  <EventCard key={e.id} event={e} onRsvp={toggleRsvp} userRsvp={getUserRsvp(e.id)}
                    isPast={false} allUpcoming={upcoming} minThreshold={minThreshold}
                    isRestricted={profile?.reliability_status === 'restricted'}
                    circleUserIds={circleUserIds} />
                ))}
              <SessionRequestSheet />
            </TabsContent>
            <TabsContent value="past" className="space-y-3 mt-3">
              {loading ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />) :
                filterEvents(past).length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-8">No past sessions yet</p>
                ) : filterEvents(past).map((e) => (
                  <EventCard key={e.id} event={e} onRsvp={toggleRsvp} userRsvp={getUserRsvp(e.id)}
                    isPast={true} allUpcoming={upcoming} minThreshold={minThreshold}
                    circleUserIds={circleUserIds} />
                ))}
            </TabsContent>
          </Tabs>
        )}
      </motion.div>
      </PullToRefresh>
      <CreateEventButton onCreated={fetchEvents} />
    </AppShell>
  );
}
