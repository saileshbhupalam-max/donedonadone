import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ERROR_STATES } from "@/lib/personality";
import { NEIGHBORHOODS, DAYS, DAY_LABELS } from "./constants";

export function SessionRequestSheet() {
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
