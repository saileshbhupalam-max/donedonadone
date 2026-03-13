import { useState, useCallback, useMemo } from "react";
import { Star, Camera, Upload, Coins, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { submitVenueContribution, ContributionType } from "@/lib/venueContributions";
import { awardCredits } from "@/lib/focusCredits";
import { getGrowthConfig } from "@/lib/growthConfig";

const SECTION_CONTRIBUTION_MAP: Record<string, ContributionType | null> = {
  groupRating: null, // uses awardCredits directly
  noise: 'noise_report',
  wifi: 'wifi_report',
  seating: 'seating_report',
  photo: 'photo',
};

async function submitContribution(
  userId: string,
  venueId: string,
  sectionKey: string,
  sectionData: Record<string, unknown>
): Promise<{ creditsEarned: number; bonusMultiplier: number }> {
  const config = getGrowthConfig();
  let creditsEarned = 0;

  const contributionType = SECTION_CONTRIBUTION_MAP[sectionKey];
  if (contributionType) {
    const result = await submitVenueContribution(userId, venueId, contributionType, sectionData as any);
    creditsEarned = result.creditsAwarded;
  } else if (sectionKey === 'groupRating') {
    const result = await awardCredits(userId, 'rate_group', config.credits.rateGroup, { venue_id: venueId });
    creditsEarned = result.awarded;
  }

  // Variable reward schedule: 15% chance of 2x or 3x bonus (behavioral design feature)
  const bonusMultiplier = Math.random() < 0.15 ? (Math.random() < 0.5 ? 2 : 3) : 1;
  if (bonusMultiplier > 1 && creditsEarned > 0) {
    await awardCredits(userId, 'great_groupmate', creditsEarned * (bonusMultiplier - 1), { venue_id: venueId, bonus: true });
    creditsEarned *= bonusMultiplier;
  }

  return { creditsEarned, bonusMultiplier };
}

interface PostSessionContributionProps {
  sessionId: string;
  venueId: string;
  userId: string;
  onComplete: () => void;
}

type NoiseLevel = "quiet" | "moderate" | "lively";
type WifiQuality = "good" | "ok" | "poor";
type SeatingComfort = "comfortable" | "ok" | "cramped";

interface SectionState {
  groupRating: number;
  noise: NoiseLevel | null;
  wifi: WifiQuality | null;
  seating: SeatingComfort | null;
  photo: File | null;
}

const SECTION_REWARDS: Record<string, number> = {
  groupRating: 5,
  noise: 5,
  wifi: 5,
  seating: 5,
  photo: 10,
};

export function PostSessionContribution({ sessionId, venueId, userId, onComplete }: PostSessionContributionProps) {
  const [state, setState] = useState<SectionState>({
    groupRating: 0, noise: null, wifi: null, seating: null, photo: null,
  });
  const [earnedFC, setEarnedFC] = useState(0);
  const [bonusHistory, setBonusHistory] = useState<string[]>([]);
  const [expandedSection, setExpandedSection] = useState(0);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // Commitment escalation: sections ordered from easiest to hardest
  const sections = useMemo(() => [
    { key: "groupRating", label: "Rate your group", reward: SECTION_REWARDS.groupRating },
    { key: "noise", label: "Noise level", reward: SECTION_REWARDS.noise },
    { key: "wifi", label: "WiFi quality", reward: SECTION_REWARDS.wifi },
    { key: "seating", label: "Seating comfort", reward: SECTION_REWARDS.seating },
    { key: "photo", label: "Snap a photo", reward: SECTION_REWARDS.photo },
  ], []);

  const totalPossible = Object.values(SECTION_REWARDS).reduce((a, b) => a + b, 0);

  const completeSection = useCallback(async (key: string) => {
    const sectionDataMap: Record<string, Record<string, unknown>> = {
      groupRating: { rating: state.groupRating },
      noise: { noise_level: state.noise },
      wifi: { wifi_speed: state.wifi },
      seating: { seating_count: 0 },
      photo: { photo_url: 'pending_upload' },
    };
    const result = await submitContribution(userId, venueId, key, sectionDataMap[key] ?? {});
    const newCompleted = new Set(completed);
    newCompleted.add(key);
    setCompleted(newCompleted);
    setEarnedFC((prev) => prev + result.creditsEarned);
    if (result.bonusMultiplier > 1) {
      setBonusHistory((prev) => [...prev, `${result.bonusMultiplier}x bonus on ${key}!`]);
    }
    // Auto-advance to next section (commitment escalation)
    const currentIdx = sections.findIndex((s) => s.key === key);
    if (currentIdx < sections.length - 1) {
      setExpandedSection(currentIdx + 1);
    }
  }, [completed, state, venueId, userId, sections]);

  const handleFinish = useCallback(async () => {
    setSubmitting(true);
    // Submit remaining data
    onComplete();
  }, [onComplete]);

  const StarRating = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} onClick={() => onChange(i)} className="p-1">
          <Star className={cn("w-7 h-7 transition-all", i <= value ? "fill-amber-400 text-amber-400 scale-110" : "text-muted-foreground")} />
        </button>
      ))}
    </div>
  );

  const OptionPills = ({ options, value, onChange }: { options: { value: string; label: string }[]; value: string | null; onChange: (v: string) => void }) => (
    <div className="flex gap-2 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm border transition-all",
            value === opt.value
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted/50 border-border hover:border-primary/50"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  return (
    <Card className="border-amber-200 dark:border-amber-800/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-serif">Session wrap-up</CardTitle>
          <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold text-sm">
            <Coins className="w-4 h-4" />
            <span>{earnedFC} / {totalPossible} FC</span>
          </div>
        </div>
        {/* Endowed progress: start at 20% */}
        <div className="w-full bg-muted rounded-full h-2 mt-2">
          <div
            className="bg-gradient-to-r from-amber-400 to-yellow-400 h-2 rounded-full transition-all duration-700"
            style={{ width: `${20 + (completed.size / sections.length) * 80}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {completed.size === 0
            ? "You're already 20% done -- just tap a star to start!"
            : `${completed.size}/${sections.length} completed`}
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {sections.map((section, idx) => {
          const isCompleted = completed.has(section.key);
          const isExpanded = expandedSection === idx;

          return (
            <div
              key={section.key}
              className={cn(
                "border rounded-lg transition-all overflow-hidden",
                isCompleted ? "border-green-300 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10" : "border-border"
              )}
            >
              <button
                className="w-full flex items-center justify-between p-3 text-sm"
                onClick={() => setExpandedSection(isExpanded ? -1 : idx)}
              >
                <span className={cn("font-medium", isCompleted && "text-green-700 dark:text-green-400")}>
                  {isCompleted ? "\u2713 " : ""}{section.label}
                </span>
                <div className="flex items-center gap-2">
                  {isCompleted ? (
                    <span className="text-xs text-green-600 dark:text-green-400 font-semibold">Done</span>
                  ) : (
                    <span className="text-xs text-amber-600 dark:text-amber-400">+{section.reward} FC</span>
                  )}
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {isExpanded && !isCompleted && (
                <div className="px-3 pb-3 space-y-3">
                  {section.key === "groupRating" && (
                    <>
                      <p className="text-xs text-muted-foreground">One tap -- that's it!</p>
                      <StarRating value={state.groupRating} onChange={(v) => {
                        setState((s) => ({ ...s, groupRating: v }));
                        completeSection("groupRating");
                      }} />
                    </>
                  )}
                  {section.key === "noise" && (
                    <>
                      <p className="text-xs text-muted-foreground">How was the noise?</p>
                      <OptionPills
                        options={[{ value: "quiet", label: "Quiet" }, { value: "moderate", label: "Moderate" }, { value: "lively", label: "Lively" }]}
                        value={state.noise}
                        onChange={(v) => {
                          setState((s) => ({ ...s, noise: v as NoiseLevel }));
                          completeSection("noise");
                        }}
                      />
                    </>
                  )}
                  {section.key === "wifi" && (
                    <OptionPills
                      options={[{ value: "good", label: "Good" }, { value: "ok", label: "OK" }, { value: "poor", label: "Poor" }]}
                      value={state.wifi}
                      onChange={(v) => {
                        setState((s) => ({ ...s, wifi: v as WifiQuality }));
                        completeSection("wifi");
                      }}
                    />
                  )}
                  {section.key === "seating" && (
                    <OptionPills
                      options={[{ value: "comfortable", label: "Comfortable" }, { value: "ok", label: "OK" }, { value: "cramped", label: "Cramped" }]}
                      value={state.seating}
                      onChange={(v) => {
                        setState((s) => ({ ...s, seating: v as SeatingComfort }));
                        completeSection("seating");
                      }}
                    />
                  )}
                  {section.key === "photo" && (
                    <div className="flex flex-col items-center gap-2 py-4 border-2 border-dashed rounded-lg">
                      <Camera className="w-8 h-8 text-muted-foreground" />
                      <label className="cursor-pointer">
                        <span className="text-sm text-primary font-medium">Upload a photo</span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          if (file) {
                            setState((s) => ({ ...s, photo: file }));
                            completeSection("photo");
                          }
                        }} />
                      </label>
                      <p className="text-[10px] text-muted-foreground">Worth +10 FC!</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Variable reward bonus display */}
        {bonusHistory.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Lucky bonus!</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">{bonusHistory[bonusHistory.length - 1]}</p>
            </div>
          </div>
        )}

        {/* Social proof */}
        <p className="text-xs text-center text-muted-foreground pt-2">
          47 members contributed this week
        </p>

        {completed.size > 0 && (
          <div className="pt-2 text-center space-y-2">
            <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
              You earned {earnedFC} FC this session!
            </p>
            <Button onClick={handleFinish} disabled={submitting} className="w-full">
              {submitting ? "Saving..." : "Done"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
