import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useUserContext } from "@/hooks/useUserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MapPin, Loader2, CheckCircle2, Building2, Coffee, Trees, Navigation } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow, parseISO } from "date-fns";

interface ResolvedLocation {
  location_id: string;
  name: string;
  location_type: string;
  distance_meters: number;
}

interface CheckInFlowProps {
  open: boolean;
  onClose: () => void;
  onCheckIn: () => void;
}

const STATUS_OPTIONS = [
  { value: "available", emoji: "🟢", label: "Available", desc: "Open to chat and connection", color: "bg-green-500" },
  { value: "deep_work", emoji: "🟡", label: "Deep Work", desc: "Focused, don't disturb", color: "bg-amber-500" },
  { value: "busy", emoji: "🔴", label: "Busy", desc: "In a meeting or call", color: "bg-red-500" },
];

const LOCATION_TYPE_ICONS: Record<string, typeof Building2> = {
  tech_park: Building2,
  cafe: Coffee,
  neighborhood: Trees,
  coworking_space: Building2,
};

export function CheckInFlow({ open, onClose, onCheckIn }: CheckInFlowProps) {
  const { user } = useAuth();
  const { isEnabled } = useFeatureFlags();
  const { position, requestPosition, status: geoStatus } = useGeolocation();
  const [step, setStep] = useState(0);
  const [resolvedLocation, setResolvedLocation] = useState<ResolvedLocation | null>(null);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [noMatch, setNoMatch] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualLocationId, setManualLocationId] = useState<string>("");
  const [allLocations, setAllLocations] = useState<any[]>([]);
  const [selectedStatus, setSelectedStatus] = useState("available");
  const [selectedMode, setSelectedMode] = useState<"work" | "open">("work");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // Step 0: Detect location
  useEffect(() => {
    if (!open) {
      setStep(0);
      setResolvedLocation(null);
      setNoMatch(false);
      setManualMode(false);
      setSelectedStatus("available");
      setSelectedMode("work");
      setNote("");
      setDone(false);
      return;
    }
    detectLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const detectLocation = async () => {
    setLocationsLoading(true);
    const pos = await requestPosition();
    if (!pos) {
      // GPS denied — go to manual
      setManualMode(true);
      await fetchAllLocations();
      setLocationsLoading(false);
      setStep(1);
      return;
    }

    // Resolve location
    const { data, error } = await supabase.rpc("resolve_check_in_location", {
      p_latitude: pos.latitude,
      p_longitude: pos.longitude,
    });

    if (data && data.length > 0) {
      setResolvedLocation(data[0] as ResolvedLocation);
    } else {
      setNoMatch(true);
    }
    setLocationsLoading(false);
    setStep(1);
  };

  const fetchAllLocations = async () => {
    const { data } = await supabase.from("locations").select("id, name, location_type, neighborhood").order("name");
    setAllLocations(data || []);
  };

  const handleSwitchToManual = async () => {
    setManualMode(true);
    setResolvedLocation(null);
    await fetchAllLocations();
  };

  const handleSubmit = async () => {
    if (!user) return;
    setSaving(true);

    const locationId = manualMode ? (manualLocationId || null) : (resolvedLocation?.location_id || null);

    const { error } = await supabase.from("check_ins").insert({
      user_id: user.id,
      location_id: locationId,
      latitude: position?.latitude || null,
      longitude: position?.longitude || null,
      status: selectedStatus,
      mode: selectedMode,
      note: note.trim() || null,
      auto_detected: !manualMode && !!resolvedLocation,
    });

    if (error) {
      toast.error("Failed to check in");
      setSaving(false);
      return;
    }

    // Increment member count on first check-in at a location
    if (locationId) {
      try { await supabase.rpc("increment_location_member_count", { p_location_id: locationId }); } catch (e) { console.error("[check-in] increment failed:", e); }
    }

    setSaving(false);
    setDone(true);
    toast.success("Checked in!");

    setTimeout(() => {
      onCheckIn();
      onClose();
    }, 1200);
  };

  const showPlayMode = isEnabled("play_mode");

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="font-serif text-lg">Check In</SheetTitle>
        </SheetHeader>

        <AnimatePresence mode="wait">
          {/* Done state */}
          {done && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3 py-8"
            >
              <CheckCircle2 className="w-12 h-12 text-green-500" />
              <p className="font-serif text-lg text-foreground">
                Checked in{resolvedLocation ? ` at ${resolvedLocation.name}` : ""}!
              </p>
            </motion.div>
          )}

          {/* Step 1: Location */}
          {!done && step === 1 && (
            <motion.div key="location" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 py-4">
              {locationsLoading ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Finding your location...</p>
                </div>
              ) : resolvedLocation && !manualMode ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                    <MapPin className="w-5 h-5 text-primary shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{resolvedLocation.name}</p>
                      <Badge variant="outline" className="text-[10px] mt-1 capitalize">{resolvedLocation.location_type.replace("_", " ")}</Badge>
                    </div>
                  </div>
                  <button className="text-xs text-muted-foreground hover:underline" onClick={handleSwitchToManual}>
                    Not here? Select manually
                  </button>
                </div>
              ) : noMatch && !manualMode ? (
                <div className="space-y-3">
                  <p className="text-sm text-foreground">Working from a new spot?</p>
                  <p className="text-xs text-muted-foreground">We couldn't match your location. You can select one or just check in.</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleSwitchToManual}>Select location</Button>
                    <Button size="sm" variant="ghost" onClick={() => setStep(2)}>Skip — just check in</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-foreground">Select your location</p>
                  <Select value={manualLocationId} onValueChange={setManualLocationId}>
                    <SelectTrigger><SelectValue placeholder="Choose a location..." /></SelectTrigger>
                    <SelectContent>
                      {allLocations.map(l => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name} {l.neighborhood ? `(${l.neighborhood})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button className="w-full" onClick={() => setStep(2)}>Next</Button>
            </motion.div>
          )}

          {/* Step 2: Status */}
          {!done && step === 2 && (
            <motion.div key="status" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 py-4">
              <p className="text-sm font-medium text-foreground">What's your status?</p>
              <div className="grid grid-cols-3 gap-2">
                {STATUS_OPTIONS.map(s => (
                  <button
                    key={s.value}
                    onClick={() => setSelectedStatus(s.value)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      selectedStatus === s.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <span className="text-2xl block mb-1">{s.emoji}</span>
                    <p className="text-xs font-medium text-foreground">{s.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{s.desc}</p>
                  </button>
                ))}
              </div>
              <Button className="w-full" onClick={() => setStep(showPlayMode ? 3 : 4)}>Next</Button>
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setStep(1)}>Back</Button>
            </motion.div>
          )}

          {/* Step 3: Mode (only if play_mode enabled) */}
          {!done && step === 3 && showPlayMode && (
            <motion.div key="mode" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 py-4">
              <p className="text-sm font-medium text-foreground">What mode are you in?</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedMode("work")}
                  className={`p-4 rounded-xl border text-center transition-all ${selectedMode === "work" ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}
                >
                  <span className="text-2xl block mb-1">💼</span>
                  <p className="text-sm font-medium text-foreground">Work</p>
                </button>
                <button
                  onClick={() => setSelectedMode("open")}
                  className={`p-4 rounded-xl border text-center transition-all ${selectedMode === "open" ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}
                >
                  <span className="text-2xl block mb-1">✨</span>
                  <p className="text-sm font-medium text-foreground">Open to both</p>
                </button>
              </div>
              <Button className="w-full" onClick={() => setStep(4)}>Next</Button>
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setStep(2)}>Back</Button>
            </motion.div>
          )}

          {/* Step 4: Note */}
          {!done && step === 4 && (
            <motion.div key="note" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 py-4">
              <p className="text-sm font-medium text-foreground">What are you working on?</p>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 100))}
                placeholder="Building a pitch deck..."
                maxLength={100}
              />
              <p className="text-[10px] text-muted-foreground text-right">{note.length}/100</p>
              <Button className="w-full" onClick={handleSubmit} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Check In
              </Button>
              <button className="text-xs text-muted-foreground hover:underline w-full text-center" onClick={handleSubmit}>
                Skip & check in
              </button>
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setStep(2)}>Back</Button>
            </motion.div>
          )}

          {/* Loading initial */}
          {!done && step === 0 && (
            <motion.div key="init" className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Getting your location...</p>
            </motion.div>
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  );
}

// Active check-in card for Home
export function ActiveCheckInCard() {
  const { user } = useAuth();
  const { currentState, activeCheckIn, currentLocation, refreshCheckIn } = useUserContext();

  if (!activeCheckIn || currentState === "offline") return null;

  const statusEmoji = activeCheckIn.status === "available" ? "🟢" : activeCheckIn.status === "deep_work" ? "🟡" : "🔴";
  const statusLabel = activeCheckIn.status === "available" ? "Available" : activeCheckIn.status === "deep_work" ? "Deep Work" : "Busy";

  // Check-in age for expiry warning
  const checkinAgeMs = Date.now() - parseISO(activeCheckIn.checked_in_at).getTime();
  const checkinAgeHours = checkinAgeMs / (1000 * 60 * 60);
  const expiryWarning = checkinAgeHours >= 7.5 ? "red" : checkinAgeHours >= 6 ? "yellow" : null;

  const handleCheckOut = async () => {
    await supabase.from("check_ins").update({ checked_out_at: new Date().toISOString() }).eq("id", activeCheckIn.id);
    toast.success("Checked out!");
    refreshCheckIn();
  };

  const handleStatusChange = async (newStatus: string) => {
    await supabase.from("check_ins").update({ status: newStatus }).eq("id", activeCheckIn.id);
    refreshCheckIn();
  };

  return (
    <Card className="border-green-500/20 bg-green-50/50 dark:bg-green-950/10">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{statusEmoji}</span>
            <div>
              <p className="text-sm font-medium text-foreground">
                Checked in{currentLocation ? ` at ${currentLocation.name}` : ""}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {statusLabel} · {formatDistanceToNow(parseISO(activeCheckIn.checked_in_at), { addSuffix: true })}
              </p>
              {expiryWarning === "red" && (
                <Badge variant="destructive" className="text-[9px] h-4 px-1.5 mt-0.5">About to expire</Badge>
              )}
              {expiryWarning === "yellow" && (
                <Badge variant="outline" className="text-[9px] h-4 px-1.5 mt-0.5 border-yellow-500/50 text-yellow-700 dark:text-yellow-400">Expiring soon</Badge>
              )}
            </div>
          </div>
        </div>
        {activeCheckIn.note && (
          <p className="text-xs text-muted-foreground italic">"{activeCheckIn.note}"</p>
        )}
        <div className="flex gap-2">
          <Select value={activeCheckIn.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.emoji} {s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={handleCheckOut}>Check out</Button>
        </div>
      </CardContent>
    </Card>
  );
}
