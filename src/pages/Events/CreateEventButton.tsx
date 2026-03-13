import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEvents } from "@/hooks/useEvents";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CalendarIcon, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createSessionPhases, getFormatPhases } from "@/lib/sessionPhases";
import { ERROR_STATES } from "@/lib/personality";
import { NEIGHBORHOODS } from "./constants";

export function CreateEventButton({ onCreated }: { onCreated: () => void }) {
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
                  <SelectItem value="focus_only_2hr">🎧 Focus Only 2hr</SelectItem>
                  <SelectItem value="focus_only_4hr">🎧 Focus Only 4hr</SelectItem>
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
