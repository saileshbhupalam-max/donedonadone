import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Send, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ERROR_STATES } from "@/lib/personality";
import { DAYS, DAY_LABELS } from "./constants";
import { NeighborhoodInput } from "@/components/ui/NeighborhoodInput";
import { normalizeNeighborhood } from "@/lib/neighborhoods";
import { onNewSessionRequest } from "@/lib/autoSession";

const SESSION_WINDOWS = [
  { id: "morning", label: "Morning Focus", time: "9:30 AM – 1:30 PM", description: "Deep work, fewer distractions" },
  { id: "afternoon", label: "Afternoon Hustle", time: "2:00 – 6:00 PM", description: "Energy + networking" },
  { id: "evening", label: "Evening", time: "6:00 – 9:00 PM", description: "After-hours cowork" },
];

interface SessionRequestSheetProps {
  /** Controls how the trigger button renders:
   * - undefined (default): dashed card with "Want a session on your schedule?"
   * - "inline": compact text link for the top-of-list banner
   * - "primary": prominent button for empty states */
  triggerVariant?: "inline" | "primary";
}

export function SessionRequestSheet({ triggerVariant }: SessionRequestSheetProps = {}) {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [requestType, setRequestType] = useState("general");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [preferredTime, setPreferredTime] = useState("");
  const [neighborhood, setNeighborhood] = useState(profile?.neighborhood || "");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const toggleDay = (day: string) => setSelectedDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);

  const handleSubmit = async () => {
    if (!user || !neighborhood) return;
    setSubmitting(true);
    const normalizedNeighborhood = normalizeNeighborhood(neighborhood);
    try {
      const { error } = await supabase.from("session_requests").insert({
        user_id: user.id, request_type: requestType, preferred_days: selectedDays,
        preferred_time: preferredTime || null, neighborhood: normalizedNeighborhood, notes: notes || null,
      });
      if (error) throw error;

      // Event-based trigger: check if this request completes a cluster
      if (preferredTime) {
        const eventId = await onNewSessionRequest(normalizedNeighborhood, preferredTime);
        if (eventId) {
          toast.success("Session auto-created! Enough people want to work together.");
        } else {
          toast.success("Request submitted! We'll create a session when more people join.");
        }
      } else {
        toast.success("Session request submitted!");
      }

      setOpen(false);
      setSelectedDays([]); setPreferredTime(""); setNeighborhood(""); setNotes(""); setRequestType("general");
    } catch (error) {
      console.error("[SessionRequest]", error);
      toast.error(ERROR_STATES.generic);
    } finally { setSubmitting(false); }
  };

  const triggerButton = triggerVariant === "inline" ? (
    <SheetTrigger asChild>
      <Button variant="link" size="sm" className="text-primary px-0 h-auto text-xs font-medium">
        Request one {"\u2192"}
      </Button>
    </SheetTrigger>
  ) : triggerVariant === "primary" ? (
    <SheetTrigger asChild>
      <Button size="default" className="rounded-full">
        <Send className="w-4 h-4 mr-1" /> Request a Session
      </Button>
    </SheetTrigger>
  ) : (
    <>
      <p className="text-sm text-muted-foreground mb-2">Want a session on your schedule?</p>
      <SheetTrigger asChild><Button variant="outline" size="sm">Tell us when {"\u2192"}</Button></SheetTrigger>
    </>
  );

  // WHY three trigger variants: The default card works at the bottom of the list.
  // The "inline" variant fits inside the top-of-list banner without disrupting layout.
  // The "primary" variant gives the empty state a strong, unmissable CTA that makes
  // requesting feel like the natural next step (not a consolation prize).
  const wrapInCard = !triggerVariant;

  return wrapInCard ? (
    <Card className="border-dashed">
      <CardContent className="p-4 text-center">
        <Sheet open={open} onOpenChange={setOpen}>
          {triggerButton}
          <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-2xl">
            <SheetHeader><SheetTitle className="font-serif">When do you want to cowork?</SheetTitle></SheetHeader>
            <div className="space-y-4 mt-4">
              {profile?.gender === "woman" && (
                <div className="flex items-center gap-3">
                  <Switch checked={requestType === "women_only"} onCheckedChange={(v) => setRequestType(v ? "women_only" : "general")} />
                  <Label>Women-only session</Label>
                </div>
              )}
              <div>
                <Label className="text-sm">When works for you?</Label>
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
                <Label className="text-sm">What time of day?</Label>
                <div className="space-y-2 mt-2">
                  {SESSION_WINDOWS.map((w) => (
                    <button key={w.id} onClick={() => setPreferredTime(w.id)}
                      className={cn("w-full px-4 py-3 rounded-xl border text-left transition-all",
                        preferredTime === w.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted")}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{w.label}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{w.time}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{w.description}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm">Where?</Label>
                <NeighborhoodInput
                  value={neighborhood}
                  onChange={(slug) => setNeighborhood(slug)}
                  placeholder="Type your area..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">Notes (optional)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any preferences?" rows={2} className="mt-1" />
              </div>
              <Button className="w-full" onClick={handleSubmit} disabled={!neighborhood || submitting}>
                <Send className="w-4 h-4" /> {submitting ? "Matching you..." : "Find my table"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                We'll match you when enough people want the same slot
              </p>
            </div>
          </SheetContent>
        </Sheet>
      </CardContent>
    </Card>
  ) : (
    <Sheet open={open} onOpenChange={setOpen}>
      {triggerButton}
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader><SheetTitle className="font-serif">When do you want to cowork?</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-4">
          {profile?.gender === "woman" && (
            <div className="flex items-center gap-3">
              <Switch checked={requestType === "women_only"} onCheckedChange={(v) => setRequestType(v ? "women_only" : "general")} />
              <Label>Women-only session</Label>
            </div>
          )}
          <div>
            <Label className="text-sm">When works for you?</Label>
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
            <Label className="text-sm">What time of day?</Label>
            <div className="space-y-2 mt-2">
              {SESSION_WINDOWS.map((w) => (
                <button key={w.id} onClick={() => setPreferredTime(w.id)}
                  className={cn("w-full px-4 py-3 rounded-xl border text-left transition-all",
                    preferredTime === w.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted")}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{w.label}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{w.time}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{w.description}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-sm">Where?</Label>
            <NeighborhoodInput value={neighborhood} onChange={(slug) => setNeighborhood(slug)} placeholder="Type your area..." className="mt-1" />
          </div>
          <div>
            <Label className="text-sm">Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any preferences?" rows={2} className="mt-1" />
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={!neighborhood || submitting}>
            <Send className="w-4 h-4" /> {submitting ? "Matching you..." : "Find my table"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            We'll match you when enough people want the same slot
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
