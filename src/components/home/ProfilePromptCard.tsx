/* DESIGN: Data not collected during onboarding is gathered progressively.
   Each prompt appears when the data becomes meaningful — after real sessions.
   We never say "complete your profile" — we say "now that you've been..." */

import { useState, lazy, Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { TagInput } from "@/components/onboarding/TagInput";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeProfileData } from "@/lib/profileValidation";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CONFIRMATIONS } from "@/lib/personality";
import { Linkedin, Instagram, Twitter, Phone, Navigation } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

const LocationPicker = lazy(() => import("@/components/map/LocationPicker").then(m => ({ default: m.LocationPicker })));

type Profile = Tables<"profiles">;

type PromptType = "work-style" | "location" | "schedule" | "interests" | "socials" | "buddy" | null;

function getPromptType(profile: Profile): PromptType {
  const attended = profile.events_attended || 0;
  const dismissed = JSON.parse(localStorage.getItem("dismissed_prompts") || "{}");
  const isDismissed = (key: string) => dismissed[key] && attended - dismissed[key] < 3;

  if (attended >= 1 && !profile.noise_preference && !isDismissed("work-style"))
    return "work-style";
  if (attended >= 1 && !profile.preferred_latitude && !isDismissed("location"))
    return "location";
  if (attended >= 2 && (!profile.preferred_days || profile.preferred_days.length === 0) && !isDismissed("schedule"))
    return "schedule";
  if (attended >= 2 && (!profile.interests || profile.interests.length === 0) && !isDismissed("interests"))
    return "interests";
  if (attended >= 3 && !profile.linkedin_url && !isDismissed("socials"))
    return "socials";
  if (attended >= 3 && !profile.is_welcome_buddy && !isDismissed("buddy"))
    return "buddy";
  return null;
}

const NOISE = [
  { id: "silent", emoji: "🤫", label: "Quiet" },
  { id: "low_hum", emoji: "🎵", label: "Moderate" },
  { id: "dont_care", emoji: "🤷", label: "Lively" },
];
const COMM = [
  { id: "minimal", emoji: "🧘", label: "Heads-down" },
  { id: "moderate", emoji: "⚡", label: "Friendly" },
  { id: "chatty", emoji: "💬", label: "Social butterfly" },
];
const DAYS = [
  { id: "monday", label: "Mon" }, { id: "tuesday", label: "Tue" }, { id: "wednesday", label: "Wed" },
  { id: "thursday", label: "Thu" }, { id: "friday", label: "Fri" }, { id: "saturday", label: "Sat" }, { id: "sunday", label: "Sun" },
];
const TIMES = [
  { id: "morning", label: "🌅 Morning (8-12)" },
  { id: "afternoon", label: "☀️ Afternoon (12-5)" },
  { id: "evening", label: "🌙 Evening (5-9)" },
];
const INTEREST_SUGGESTIONS = [
  "startups", "design", "coding", "fitness", "reading", "gaming", "music",
  "photography", "travel", "food", "investing", "AI/ML", "crypto", "writing",
];

export function ProfilePromptCard({ profile }: { profile: Profile }) {
  const { user, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const promptType = getPromptType(profile);

  // Work style state
  const [noise, setNoise] = useState("");
  const [comm, setComm] = useState("");

  // Location state
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [radius, setRadius] = useState(5);

  // Schedule state
  const [days, setDays] = useState<string[]>([]);
  const [times, setTimes] = useState<string[]>([]);
  const [duration, setDuration] = useState(2);

  // Interests state
  const [interests, setInterests] = useState<string[]>([]);

  // Socials state
  const [linkedin, setLinkedin] = useState("");
  const [instagram, setInstagram] = useState("");
  const [twitter, setTwitter] = useState("");
  const [phone, setPhone] = useState("");

  if (!promptType || !user) return null;

  const dismiss = () => {
    const dismissed = JSON.parse(localStorage.getItem("dismissed_prompts") || "{}");
    dismissed[promptType] = profile.events_attended || 0;
    localStorage.setItem("dismissed_prompts", JSON.stringify(dismissed));
    // Force re-render by refreshing
    refreshProfile();
  };

  const save = async (data: Record<string, any>) => {
    setSaving(true);
    await supabase.from("profiles").update(sanitizeProfileData(data)).eq("id", user.id);
    await refreshProfile();
    setSaving(false);
    toast.success(CONFIRMATIONS.profileSaved);
  };

  const toggleChip = (arr: string[], id: string, setter: (v: string[]) => void) => {
    setter(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);
  };

  const chipClass = (selected: boolean) => cn(
    "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
    selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/40"
  );

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 space-y-4">
        {promptType === "work-style" && (
          <>
            <p className="font-serif text-sm text-foreground">Now that you've been to a session... how do you like your workspace?</p>
            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground">Noise preference</label>
              <div className="grid grid-cols-3 gap-2">
                {NOISE.map(n => (
                  <button key={n.id} onClick={() => setNoise(n.id)} className={cn(
                    "flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all",
                    noise === n.id ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40"
                  )}>
                    <span className="text-xl">{n.emoji}</span>
                    <span className="text-xs font-medium text-foreground">{n.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground">Communication style</label>
              <div className="grid grid-cols-3 gap-2">
                {COMM.map(c => (
                  <button key={c.id} onClick={() => setComm(c.id)} className={cn(
                    "flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all",
                    comm === c.id ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40"
                  )}>
                    <span className="text-xl">{c.emoji}</span>
                    <span className="text-xs font-medium text-foreground">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <Button size="sm" disabled={saving || (!noise && !comm)} onClick={() => save({ noise_preference: noise || undefined, communication_style: comm || undefined })}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </>
        )}

        {promptType === "location" && (
          <>
            <p className="font-serif text-sm text-foreground">Want to see sessions near you?</p>
            <Suspense fallback={<Skeleton className="h-[200px] rounded-xl" />}>
              <LocationPicker
                latitude={lat}
                longitude={lng}
                radiusKm={radius}
                onLocationChange={(la, ln) => { setLat(la); setLng(ln); }}
                onRadiusChange={(r) => setRadius(r)}
                height="180px"
              />
            </Suspense>
            <Button size="sm" disabled={saving || !lat} onClick={() => save({ preferred_latitude: lat, preferred_longitude: lng, preferred_radius_km: radius })}>
              {saving ? "Saving..." : "Save location"}
            </Button>
          </>
        )}

        {promptType === "schedule" && (
          <>
            <p className="font-serif text-sm text-foreground">Finding your rhythm? When do you like to work?</p>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {DAYS.map(d => (
                  <button key={d.id} onClick={() => toggleChip(days, d.id, setDays)} className={chipClass(days.includes(d.id))}>{d.label}</button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {TIMES.map(t => (
                  <button key={t.id} onClick={() => toggleChip(times, t.id, setTimes)} className={chipClass(times.includes(t.id))}>{t.label}</button>
                ))}
              </div>
              <div className="flex gap-3">
                {[2, 4].map(h => (
                  <button key={h} onClick={() => setDuration(h)} className={cn(
                    "flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all",
                    duration === h ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-foreground hover:border-primary/40"
                  )}>{h} hours</button>
                ))}
              </div>
            </div>
            <Button size="sm" disabled={saving || (days.length === 0 && times.length === 0)} onClick={() => save({ preferred_days: days, preferred_times: times, preferred_session_duration: duration })}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </>
        )}

        {promptType === "interests" && (
          <>
            <p className="font-serif text-sm text-foreground">What are you into outside of work?</p>
            <TagInput label="" tags={interests} onChange={setInterests} suggestions={INTEREST_SUGGESTIONS} variant="primary" placeholder="Type + Enter" />
            <Button size="sm" disabled={saving || interests.length === 0} onClick={() => save({ interests })}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </>
        )}

        {promptType === "socials" && (
          <>
            <p className="font-serif text-sm text-foreground">Your tablemates want to connect!</p>
            <div className="space-y-3">
              <div className="relative">
                <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="linkedin.com/in/you" className="pl-10 rounded-xl" />
              </div>
              <div className="relative">
                <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@handle" className="pl-10 rounded-xl" />
              </div>
              <div className="relative">
                <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={twitter} onChange={e => setTwitter(e.target.value)} placeholder="@handle" className="pl-10 rounded-xl" />
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone (WhatsApp only)" className="pl-10 rounded-xl" />
              </div>
            </div>
            <Button size="sm" disabled={saving || (!linkedin && !instagram && !twitter && !phone)} onClick={() => save({
              linkedin_url: linkedin || null, instagram_handle: instagram || null, twitter_handle: twitter || null, phone: phone || null,
            })}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </>
        )}

        {promptType === "buddy" && (
          <>
            <p className="font-serif text-sm text-foreground">You're a regular now! Want to welcome first-timers at your next session?</p>
            <p className="text-xs text-muted-foreground">It's just saying hi when they arrive. Makes a huge difference.</p>
            <Button size="sm" onClick={() => save({ is_welcome_buddy: true })}>
              {saving ? "Saving..." : "Sure! 🤝"}
            </Button>
          </>
        )}

        <button onClick={dismiss} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Not now
        </button>
      </CardContent>
    </Card>
  );
}
