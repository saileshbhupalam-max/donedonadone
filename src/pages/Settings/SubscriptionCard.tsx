import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, Zap, ExternalLink } from "lucide-react";

function SubscriptionCard() {
  const { tierName, isBoosted } = useSubscription();
  const navigate = useNavigate();

  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <h2 className="font-serif text-base text-foreground">Subscription</h2>
        <button
          onClick={() => navigate("/pricing")}
          className="flex items-center gap-3 w-full p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
        >
          <CreditCard className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
              {tierName}
              {isBoosted && <Zap className="w-3.5 h-3.5 text-primary" />}
            </p>
            <p className="text-[10px] text-muted-foreground">View plans & upgrade</p>
          </div>
          <ExternalLink className="w-4 h-4 text-muted-foreground" />
        </button>
      </CardContent>
    </Card>
  );
}

export default SubscriptionCard;
