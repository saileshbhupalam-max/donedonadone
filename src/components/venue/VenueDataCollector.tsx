/**
 * @module VenueDataCollector
 * @description Bottom sheet for collecting exhaustive venue data.
 * Users tap category tiles to submit data and earn FC (with first-mover 2x bonus).
 *
 * Key exports: VenueDataCollector
 * Dependencies: venueContributions, focusCredits
 * Tables: venue_contributions
 */
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { submitVenueContribution, type ContributionType, type ContributionData, type VenueCompleteness } from "@/lib/venueContributions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venueId: string;
  venueName: string;
  userId: string;
  completeness: VenueCompleteness | null;
  onContributed: () => void;
}

interface DataCategory {
  type: ContributionType;
  label: string;
  emoji: string;
  isComplete: boolean;
}

export function VenueDataCollector({ open, onOpenChange, venueId, venueName, userId, completeness, onContributed }: Props) {
  const [selectedType, setSelectedType] = useState<ContributionType | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state for each type
  const [lightingType, setLightingType] = useState<string>("");
  const [tempComfort, setTempComfort] = useState<string>("");
  const [restroomRating, setRestroomRating] = useState([3]);
  const [deskType, setDeskType] = useState<string>("");
  const [outletCount, setOutletCount] = useState<string>("");
  const [noiseDb, setNoiseDb] = useState([50]);

  const categories: DataCategory[] = [
    { type: "lighting", label: "Lighting", emoji: "💡", isComplete: completeness?.lighting ?? false },
    { type: "temperature", label: "Temperature", emoji: "🌡️", isComplete: completeness?.temperature ?? false },
    { type: "ambient_noise", label: "Noise Level", emoji: "🔊", isComplete: completeness?.ambientNoise ?? false },
    { type: "restroom", label: "Restrooms", emoji: "🚻", isComplete: completeness?.restroom ?? false },
    { type: "desk_layout", label: "Desk Layout", emoji: "🪑", isComplete: completeness?.deskLayout ?? false },
    { type: "outlet_locations", label: "Power Outlets", emoji: "🔌", isComplete: completeness?.outletLocations ?? false },
  ];

  const handleSubmit = async () => {
    if (!selectedType) return;
    setSubmitting(true);

    let data: ContributionData = {};
    switch (selectedType) {
      case "lighting": data = { lighting_type: lightingType as any }; break;
      case "temperature": data = { temperature_comfort: tempComfort as any }; break;
      case "ambient_noise": data = { ambient_noise_db: noiseDb[0] }; break;
      case "restroom": data = { restroom_rating: restroomRating[0] as any }; break;
      case "desk_layout": data = { desk_type: deskType as any }; break;
      case "outlet_locations": data = { outlet_count: outletCount as any }; break;
    }

    const result = await submitVenueContribution(userId, venueId, selectedType, data);
    setSubmitting(false);

    if (result.success) {
      const bonus = result.isFirstMover ? " (first report — 2x bonus!)" : "";
      toast.success(`+${result.creditsAwarded} FC${bonus}`);
      setSelectedType(null);
      onContributed();
    } else {
      toast.error(result.reason || "Could not submit. Try again.");
    }
  };

  const incompleteCount = categories.filter(c => !c.isComplete).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="font-serif text-lg">Add venue data</SheetTitle>
          <p className="text-xs text-muted-foreground">
            {incompleteCount > 0
              ? `${incompleteCount} categories missing — be first for 2x FC`
              : "All categories covered — thanks for contributing!"}
          </p>
        </SheetHeader>

        {!selectedType ? (
          <div className="grid grid-cols-3 gap-2 mt-4">
            {categories.map(c => (
              <button
                key={c.type}
                onClick={() => !c.isComplete && setSelectedType(c.type)}
                disabled={c.isComplete}
                className={`p-3 rounded-xl border text-center transition-all ${
                  c.isComplete
                    ? "border-green-200 bg-green-50 dark:bg-green-950/20 opacity-60"
                    : "border-border hover:border-primary hover:bg-primary/5"
                }`}
              >
                <span className="text-xl block">{c.emoji}</span>
                <span className="text-[10px] font-medium text-foreground mt-1 block">{c.label}</span>
                {c.isComplete && <Badge variant="outline" className="text-[8px] px-1 py-0 mt-1 border-green-300 text-green-600">Done</Badge>}
                {!c.isComplete && <Badge variant="outline" className="text-[8px] px-1 py-0 mt-1 border-primary/30 text-primary">2x FC</Badge>}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setSelectedType(null)} className="text-xs">
              ← Back
            </Button>

            {selectedType === "lighting" && (
              <div className="space-y-2">
                <p className="text-sm font-medium">How's the lighting?</p>
                <Select value={lightingType} onValueChange={setLightingType}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Pick one..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="natural">☀️ Natural light</SelectItem>
                    <SelectItem value="warm">🟡 Warm / cozy</SelectItem>
                    <SelectItem value="cool">⚪ Cool / bright</SelectItem>
                    <SelectItem value="dim">🌙 Dim / moody</SelectItem>
                    <SelectItem value="bright">💡 Very bright</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedType === "temperature" && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Temperature comfort?</p>
                <div className="flex gap-2">
                  {[
                    { val: "too_cold", label: "🥶 Too cold" },
                    { val: "comfortable", label: "👍 Just right" },
                    { val: "too_warm", label: "🥵 Too warm" },
                  ].map(opt => (
                    <button key={opt.val} onClick={() => setTempComfort(opt.val)}
                      className={`flex-1 p-3 rounded-lg border text-xs font-medium transition-all ${
                        tempComfort === opt.val ? "border-primary bg-primary/10" : "border-border"
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedType === "ambient_noise" && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Noise level (estimate)</p>
                <p className="text-xs text-muted-foreground">{noiseDb[0]} dB — {noiseDb[0] < 40 ? "Library quiet" : noiseDb[0] < 60 ? "Normal conversation" : noiseDb[0] < 75 ? "Busy cafe" : "Loud"}</p>
                <Slider value={noiseDb} onValueChange={setNoiseDb} min={20} max={90} step={5} />
              </div>
            )}

            {selectedType === "restroom" && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Restroom quality (1-5)</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setRestroomRating([n])}
                      className={`w-10 h-10 rounded-lg border text-sm font-medium transition-all ${
                        restroomRating[0] === n ? "border-primary bg-primary text-primary-foreground" : "border-border"
                      }`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedType === "desk_layout" && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Desk arrangement?</p>
                <Select value={deskType} onValueChange={setDeskType}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Pick one..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual desks</SelectItem>
                    <SelectItem value="shared_long">Long shared tables</SelectItem>
                    <SelectItem value="round">Round / small group tables</SelectItem>
                    <SelectItem value="standing">Standing desks</SelectItem>
                    <SelectItem value="mixed">Mixed layout</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedType === "outlet_locations" && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Power outlet availability?</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { val: "none", label: "❌ None visible" },
                    { val: "few", label: "🔌 A few spots" },
                    { val: "most_seats", label: "⚡ Most seats" },
                    { val: "every_seat", label: "🔋 Every seat" },
                  ].map(opt => (
                    <button key={opt.val} onClick={() => setOutletCount(opt.val)}
                      className={`p-3 rounded-lg border text-xs font-medium transition-all ${
                        outletCount === opt.val ? "border-primary bg-primary/10" : "border-border"
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={handleSubmit} disabled={submitting} className="w-full">
              {submitting ? "Submitting..." : "Submit & earn FC"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
