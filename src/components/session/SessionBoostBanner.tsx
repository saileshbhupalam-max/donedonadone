import { useState } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Zap, X } from "lucide-react";
import { toast } from "sonner";
import { trackConversion } from "@/lib/trackConversion";

const NEXT_TIER: Record<string, string> = {
  free: "Plus",
  plus: "Pro",
};

export function SessionBoostBanner() {
  const { tier, isBoosted } = useSubscription();
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem("boost_banner_dismissed") === "true");

  if (isBoosted || dismissed || !(tier in NEXT_TIER)) return null;

  const nextTierName = NEXT_TIER[tier];

  const handleDismiss = () => {
    sessionStorage.setItem("boost_banner_dismissed", "true");
    setDismissed(true);
  };

  return (
    <div className="rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-3 flex items-center gap-3">
      <Zap className="w-5 h-5 text-primary shrink-0" />
      <p className="text-xs text-foreground flex-1">
        Boost this session for <strong>₹99</strong> — unlock {nextTierName} features until midnight
      </p>
      <Button
        size="sm"
        className="text-xs h-7 shrink-0"
        onClick={() => toast.info("Coming soon!")}
      >
        Boost Now
      </Button>
      <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground p-0.5">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
