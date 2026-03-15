import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { toast } from "sonner";

export function PushOptInCard() {
  const navigate = useNavigate();
  const { isPushSupported, isPushEnabled, requestPushPermission } = usePushNotifications();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem("fc_push_dismissed") === "true");
  const [totalCheckins, setTotalCheckins] = useState(0);

  useEffect(() => {
    supabase.from("check_ins").select("id", { count: "exact", head: true })
      .then(({ count }) => setTotalCheckins(count || 0));
  }, []);

  if (!isPushSupported || isPushEnabled || dismissed || totalCheckins < 2) return null;

  const handleEnable = async () => {
    const success = await requestPushPermission();
    if (success) {
      toast.success("Push notifications enabled!");
    }
  };

  const handleDismiss = () => {
    localStorage.setItem("fc_push_dismissed", "true");
    setDismissed(true);
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Bell className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium text-foreground">Never miss a coffee match ☕</p>
            <p className="text-xs text-muted-foreground">Get notified about matches, props, and session updates even when you're away.</p>
            <div className="flex gap-2">
              <Button size="sm" className="text-xs" onClick={handleEnable}>Enable notifications</Button>
              <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => { handleDismiss(); navigate("/settings#notifications"); }}>Customize instead</Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
