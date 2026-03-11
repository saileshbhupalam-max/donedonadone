import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface Props {
  eventId: string;
  phase: string;
}

const BATTERY_LEVELS = [
  { level: 1, emoji: "🪫", label: "Drained" },
  { level: 2, emoji: "🔋", label: "Low" },
  { level: 3, emoji: "🔋🔋", label: "Okay" },
  { level: 4, emoji: "🔋🔋🔋", label: "Good" },
  { level: 5, emoji: "🔋🔋🔋🔋", label: "Full" },
];

export function EnergyCheck({ eventId, phase }: Props) {
  const { user } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [myLevel, setMyLevel] = useState<number | null>(null);
  const [groupAvg, setGroupAvg] = useState<number | null>(null);
  const [groupCount, setGroupCount] = useState(0);

  useEffect(() => {
    if (!user || !eventId) return;
    // Check if already submitted
    (async () => {
      const { data } = await supabase
        .from("energy_checks")
        .select("*")
        .eq("event_id", eventId)
        .eq("phase", phase)
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setMyLevel(data.energy_level);
        setSubmitted(true);
        loadGroupAvg();
      }
    })();
  }, [user, eventId, phase]);

  const loadGroupAvg = async () => {
    const { data } = await supabase
      .from("energy_checks")
      .select("energy_level")
      .eq("event_id", eventId)
      .eq("phase", phase);
    if (data && data.length > 0) {
      const avg = data.reduce((a: number, b: any) => a + b.energy_level, 0) / data.length;
      setGroupAvg(Math.round(avg * 20)); // Convert 1-5 to percentage
      setGroupCount(data.length);
    }
  };

  const submit = async (level: number) => {
    if (!user) return;
    setMyLevel(level);
    await supabase.from("energy_checks").upsert({
      user_id: user.id,
      event_id: eventId,
      energy_level: level,
      phase,
    }, { onConflict: "user_id,event_id,phase" });
    setSubmitted(true);
    loadGroupAvg();
  };

  if (submitted && groupAvg !== null) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 text-center space-y-2">
            <p className="text-sm font-medium text-foreground">Your table's energy: {groupAvg}% ⚡</p>
            <div className="w-full bg-border rounded-full h-3">
              <div
                className={cn("h-3 rounded-full transition-all", groupAvg >= 60 ? "bg-secondary" : groupAvg >= 40 ? "bg-[hsl(40,80%,55%)]" : "bg-destructive")}
                style={{ width: `${groupAvg}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{groupCount} people checked in</p>
            {groupAvg < 40 && (
              <p className="text-xs text-primary">Try a 1-minute stretch! 🧘</p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-primary/20">
        <CardContent className="p-4 text-center space-y-3">
          <p className="font-serif text-sm text-foreground">How's your energy? ⚡</p>
          <div className="flex justify-center gap-3">
            {BATTERY_LEVELS.map(b => (
              <button
                key={b.level}
                onClick={() => submit(b.level)}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-lg transition-all hover:bg-muted",
                  myLevel === b.level && "bg-primary/10 ring-2 ring-primary"
                )}
              >
                <span className="text-lg">{b.emoji}</span>
                <span className="text-[10px] text-muted-foreground">{b.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
