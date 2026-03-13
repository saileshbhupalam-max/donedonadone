/* DESIGN: Merged Step2Work + essentials from Step3Preferences.
   Only collects what's needed for session matching before first session:
   what you do, work vibe, gender, neighborhood, women-only interest. */

import type { OnboardingData } from "@/lib/types";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { NeighborhoodInput } from "@/components/ui/NeighborhoodInput";

interface Props {
  data: OnboardingData;
  updateData: (d: Partial<OnboardingData>) => void;
}

const VIBES = [
  { id: "deep_focus", emoji: "🎯", label: "Deep Focus", desc: "Headphones on. World off." },
  { id: "casual_social", emoji: "☕", label: "Casual Social", desc: "Work a bit. Chat a bit. Live a bit." },
  { id: "balanced", emoji: "⚖️", label: "Balanced", desc: "Best of both. You're versatile." },
];

const GENDERS = [
  { value: "woman", label: "Woman" },
  { value: "man", label: "Man" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

// Neighborhoods now loaded dynamically via NeighborhoodInput

export function Step2WorkVibe({ data, updateData }: Props) {
  return (
    <div className="flex flex-col pt-8 gap-6 max-w-sm mx-auto">
      <div className="text-center space-y-2">
        <h1 className="font-serif text-3xl text-foreground">How do you work?</h1>
        <p className="text-muted-foreground text-sm">This helps us match you with the right table</p>
      </div>

      {/* What I do */}
      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <label className="text-sm font-medium text-foreground">What do you do?</label>
          <span className="text-xs text-muted-foreground">{data.what_i_do.length}/300</span>
        </div>
        <Textarea
          value={data.what_i_do}
          onChange={(e) => {
            if (e.target.value.length <= 300) updateData({ what_i_do: e.target.value });
          }}
          placeholder="I run a design studio focused on brand identity for startups..."
          className="rounded-xl resize-none min-h-[80px]"
        />
      </div>

      {/* Work vibe */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">Work vibe</label>
        <div className="grid gap-3">
          {VIBES.map((v) => (
            <button
              key={v.id}
              onClick={() => updateData({ work_vibe: v.id })}
              className={cn(
                "flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all",
                data.work_vibe === v.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/40"
              )}
            >
              <span className="text-2xl">{v.emoji}</span>
              <div>
                <p className="font-medium text-foreground">{v.label}</p>
                <p className="text-sm text-muted-foreground">{v.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Gender */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">Gender</label>
        <p className="text-xs text-muted-foreground -mt-1">Helps us build balanced tables. That's it.</p>
        <div className="flex flex-wrap gap-2">
          {GENDERS.map((g) => (
            <button
              key={g.value}
              onClick={() => updateData({ gender: g.value, women_only_interest: g.value !== "woman" ? false : data.women_only_interest })}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium border transition-all",
                data.gender === g.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-primary/40"
              )}
            >
              {g.label}
            </button>
          ))}
        </div>

        <AnimatePresence>
          {data.gender === "woman" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-border mt-2">
                <div className="pr-4">
                  <p className="text-sm font-medium text-foreground">Women-only meetups</p>
                  <p className="text-xs text-muted-foreground">We organize women-only coworking sessions.</p>
                </div>
                <Switch
                  checked={data.women_only_interest}
                  onCheckedChange={(v) => updateData({ women_only_interest: v })}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Neighborhood */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Neighborhood</label>
        <NeighborhoodInput
          value={data.neighborhood}
          onChange={(slug) => updateData({ neighborhood: slug })}
          placeholder="Type your area (e.g., Koramangala, Shoreditch...)"
          className="rounded-xl"
        />
      </div>
    </div>
  );
}
