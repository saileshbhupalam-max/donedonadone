import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Wifi, Volume2, DoorOpen, Armchair, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { submitHealthCheck } from "@/lib/venueHealthCheck";

interface VenueHealthCheckPromptProps {
  eventId: string;
  userId: string;
  venueName: string;
  locationId: string;
  onDone?: () => void;
}

export function VenueHealthCheckPrompt({
  eventId,
  userId,
  venueName,
  locationId,
  onDone,
}: VenueHealthCheckPromptProps) {
  const [wifiOk, setWifiOk] = useState(true);
  const [noiseOk, setNoiseOk] = useState(true);
  const [stillOpen, setStillOpen] = useState(true);
  const [seatingOk, setSeatingOk] = useState(true);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    const result = await submitHealthCheck(userId, locationId, {
      wifi_ok: wifiOk,
      noise_ok: noiseOk,
      still_open: stillOpen,
      seating_ok: seatingOk,
      comment: comment || undefined,
    });

    if (result.success) {
      setDone(true);
      toast.success(`\u2705 +${result.creditsAwarded} FC \u2014 Venue checked!`);
      if (result.venueDeactivated) {
        toast.info("This venue has been flagged for review based on recent reports.");
      }
    } else {
      // Duplicate check or other error — just dismiss
      toast.info(result.error || "Already checked recently");
      setDone(true);
    }
    setSubmitting(false);
    onDone?.();
  };

  if (done) {
    return (
      <Card className="border-green-500/20 bg-green-50/30 dark:bg-green-950/10">
        <CardContent className="p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-400">
            Thanks! Venue verified. +5 FC
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <p className="text-sm font-medium text-foreground">
            Quick check: Is {venueName} still good?
          </p>
          <span className="text-xs font-semibold text-amber-600">+5 FC</span>
        </div>

        <div className="space-y-2">
          {[
            { label: "WiFi working", icon: Wifi, value: wifiOk, set: setWifiOk },
            { label: "Noise level OK", icon: Volume2, value: noiseOk, set: setNoiseOk },
            { label: "Still open", icon: DoorOpen, value: stillOpen, set: setStillOpen },
            { label: "Seating available", icon: Armchair, value: seatingOk, set: setSeatingOk },
          ].map(({ label, icon: Icon, value, set }) => (
            <div key={label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{label}</span>
              </div>
              <Switch checked={value} onCheckedChange={set} />
            </div>
          ))}
        </div>

        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 200))}
          placeholder="Any issues? (optional)"
          rows={2}
          className="text-sm"
        />

        <Button
          className="w-full"
          size="sm"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
          ) : (
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
          )}
          {submitting ? "Submitting..." : "Submit venue check"}
        </Button>
      </CardContent>
    </Card>
  );
}
