/* DESIGN: Collects what's needed for session matching before first session:
   work vibe, neighborhood, gender, women-only interest.
   "What I do" and tagline deferred to profile (progressive profiling — CXL). */

import { useState, useCallback } from "react";
import type { OnboardingData } from "@/lib/types";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { NeighborhoodInput } from "@/components/ui/NeighborhoodInput";
import { MapPin, Loader2, CheckCircle, XCircle } from "lucide-react";
import { detectUserLocation, reverseGeocode } from "@/lib/locationUtils";
import { normalizeNeighborhood } from "@/lib/neighborhoods";

interface Props {
  data: OnboardingData;
  updateData: (d: Partial<OnboardingData>) => void;
}

// WHY these states: Clear visual feedback for each geolocation outcome prevents
// user confusion. "denied" vs "error" both fall back to manual input but with
// appropriate messaging — permission denial is permanent (until browser settings
// change), while network errors are transient.
type GeoState = "idle" | "loading" | "success" | "error";

interface GeoResult {
  neighborhood: string;
  city: string;
}

const VIBES = [
  { id: "deep_focus", emoji: "\uD83C\uDFAF", label: "Deep Focus", desc: "Headphones on. World off." },
  { id: "casual_social", emoji: "\u2615", label: "Casual Social", desc: "Work a bit. Chat a bit. Live a bit." },
  { id: "balanced", emoji: "\u2696\uFE0F", label: "Balanced", desc: "Best of both. You're versatile." },
];

const GENDERS = [
  { value: "woman", label: "Woman" },
  { value: "man", label: "Man" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

export function Step2WorkVibe({ data, updateData }: Props) {
  const [geoState, setGeoState] = useState<GeoState>("idle");
  const [geoResult, setGeoResult] = useState<GeoResult | null>(null);

  // WHY useCallback: This handler triggers state updates in the parent (updateData)
  // and local state (geoState, geoResult). Wrapping in useCallback prevents stale
  // closures if the component re-renders mid-detection.
  const handleDetectLocation = useCallback(async () => {
    setGeoState("loading");
    setGeoResult(null);

    // Step 1: Get browser geolocation (lat/lng)
    const position = await detectUserLocation();
    if (!position) {
      // WHY separate error state: User may have denied permission, or the browser
      // may not support geolocation. Either way, manual entry remains available.
      setGeoState("error");
      return;
    }

    // Step 2: Reverse geocode to get neighborhood + city names
    const location = await reverseGeocode(position.lat, position.lng);
    if (!location?.neighborhood) {
      // WHY check neighborhood specifically: reverseGeocode can succeed but return
      // only city-level data in rural areas. Without a neighborhood, auto-fill
      // isn't useful — the user still needs to type manually.
      setGeoState("error");
      return;
    }

    // Step 3: Normalize and auto-fill the neighborhood
    const slug = normalizeNeighborhood(location.neighborhood);
    const result: GeoResult = {
      neighborhood: location.neighborhood,
      city: location.city || "",
    };

    setGeoResult(result);
    setGeoState("success");

    // WHY update all three fields together: lat/lng enables distance-based matching
    // in autoSession.ts, while neighborhood enables demand clustering. Both are needed
    // for the full session-matching pipeline.
    updateData({
      neighborhood: slug,
      preferred_latitude: position.lat,
      preferred_longitude: position.lng,
    });
  }, [updateData]);

  // WHY this condition: Once the user has typed a neighborhood manually, showing
  // "Detect my location" is distracting. But if they want to re-detect (e.g., they
  // moved), the success state shows a "re-detect" option.
  const showDetectButton = geoState !== "success" && !data.neighborhood;

  return (
    <div className="flex flex-col pt-8 gap-6 max-w-sm mx-auto">
      <div className="text-center space-y-2">
        <h1 className="font-serif text-3xl text-foreground">Pick your vibe.</h1>
        <p className="text-muted-foreground text-sm">We'll match you with people who work like you.</p>
      </div>

      {/* Work vibe */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-foreground">Work vibe</legend>
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
      </fieldset>

      {/* Neighborhood — with geolocation detection */}
      <div className="space-y-3">
        <label htmlFor="onboarding-neighborhood" className="text-sm font-medium text-foreground">Neighborhood</label>

        {/* Geolocation detect button — shown when no neighborhood is entered yet */}
        {showDetectButton && geoState === "idle" && (
          <button
            type="button"
            onClick={handleDetectLocation}
            className={cn(
              "w-full flex items-center justify-center gap-2 p-3.5 rounded-xl",
              "border-2 border-dashed border-primary/40 bg-primary/5",
              "text-sm font-medium text-primary",
              "hover:border-primary hover:bg-primary/10 transition-all",
              // WHY min-h-[48px]: Google's mobile UX guidelines recommend 48px
              // minimum touch targets. Onboarding is heavily mobile.
              "min-h-[48px]"
            )}
          >
            <MapPin className="w-4 h-4" />
            <span>Detect my location</span>
          </button>
        )}

        {/* Loading state — spinner while waiting for geolocation + geocoding */}
        {geoState === "loading" && (
          <div className="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl border-2 border-primary/30 bg-primary/5 text-sm text-primary">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Finding your location...</span>
          </div>
        )}

        {/* Success state — show detected neighborhood with checkmark */}
        {geoState === "success" && geoResult && (
          <div className="w-full flex items-center justify-between p-3.5 rounded-xl border-2 border-green-500/30 bg-green-500/5">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-green-700 dark:text-green-400 font-medium">
                Found: {geoResult.neighborhood}{geoResult.city ? `, ${geoResult.city}` : ""}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                // WHY reset all geo state: Let the user start fresh if detection
                // picked the wrong neighborhood (e.g., they're at a cafe in a
                // different area than where they usually work).
                setGeoState("idle");
                setGeoResult(null);
                updateData({
                  neighborhood: "",
                  preferred_latitude: null,
                  preferred_longitude: null,
                });
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline ml-2 shrink-0"
            >
              Change
            </button>
          </div>
        )}

        {/* Error state — permission denied or geocoding failed */}
        {geoState === "error" && (
          <div className="w-full flex items-center gap-2 p-3 rounded-xl border border-border bg-muted/50 text-sm">
            <XCircle className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">
              Location not available — type your neighborhood below
            </span>
          </div>
        )}

        {/* Manual neighborhood input — always available as fallback */}
        {geoState !== "success" && (
          <NeighborhoodInput
            value={data.neighborhood}
            onChange={(slug) => updateData({ neighborhood: slug })}
            placeholder="Type your area (e.g., Koramangala, Indiranagar...)"
            className="rounded-xl"
          />
        )}

        {/* WHY explain location purpose: Privacy-conscious users need to know WHY
            before granting permission. This micro-copy answers the implicit "why do
            you need my location?" question that causes permission denials. */}
        <p className="text-xs text-muted-foreground">
          {geoState === "success"
            ? "You can change this anytime in your profile settings."
            : "To find coworking sessions near you. We never share your exact location."}
        </p>
      </div>

      {/* Gender */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-foreground">Gender</legend>
        <p className="text-xs text-muted-foreground -mt-1">For balanced tables and women-only sessions.</p>
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
                  <p className="text-sm font-medium text-foreground">Women-only sessions</p>
                  <p className="text-xs text-muted-foreground">Get matched with women-only coworking tables.</p>
                </div>
                <Switch
                  checked={data.women_only_interest}
                  onCheckedChange={(v) => updateData({ women_only_interest: v })}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </fieldset>
    </div>
  );
}
