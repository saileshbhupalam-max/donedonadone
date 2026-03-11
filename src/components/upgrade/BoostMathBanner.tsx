import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, X } from "lucide-react";
import { trackConversion } from "@/lib/trackConversion";

export function BoostMathBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [totalSpent, setTotalSpent] = useState(0);
  const [boostCount, setBoostCount] = useState(0);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem("boost_math_dismissed") === "true");

  useEffect(() => {
    if (!user || dismissed) return;
    supabase
      .from("session_boosts")
      .select("amount_paise")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (!data) return;
        setBoostCount(data.length);
        setTotalSpent(data.reduce((sum, b) => sum + (b.amount_paise || 0), 0));
      });
  }, [user?.id, dismissed]);

  if (dismissed || boostCount < 2) return null;

  const totalRupees = Math.round(totalSpent / 100);

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Zap className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium text-foreground">
              You've spent ₹{totalRupees} on Session Boosts
            </p>
            <p className="text-xs text-muted-foreground">
              Plus is just ₹199/month for unlimited access.
            </p>
            <Button size="sm" className="text-xs" onClick={() => { trackConversion("clicked_upgrade", { from: "boost_math" }); navigate("/pricing"); }}>
              Upgrade to Plus
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => {
              localStorage.setItem("boost_math_dismissed", "true");
              setDismissed(true);
            }}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
