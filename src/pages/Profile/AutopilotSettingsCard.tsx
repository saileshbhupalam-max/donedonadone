import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeProfileData } from "@/lib/profileValidation";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { motion } from "framer-motion";

/* DESIGN: Autopilot settings — only shown after 3+ sessions.
   Must prove the habit before automating it. */
export function AutopilotSettingsCard({ profile, userId }: { profile: any; userId: string }) {
  const [enabled, setEnabled] = useState(profile.autopilot_enabled || false);
  const [days, setDays] = useState<string[]>(profile.autopilot_days || []);
  const [times, setTimes] = useState<string[]>(profile.autopilot_times || []);
  const [maxPerWeek, setMaxPerWeek] = useState(profile.autopilot_max_per_week || 2);
  const [preferCircle, setPreferCircle] = useState(profile.autopilot_prefer_circle ?? true);

  const save = async (updates: Record<string, any>) => {
    await supabase.from("profiles").update(sanitizeProfileData(updates)).eq("id", userId);
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
