import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield } from "lucide-react";

export function CaptainOptInCard() {
  const { profile, user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  if (!profile || (profile.events_attended || 0) < 5) return null;
  if (profile.is_table_captain) {
    return (
      <Card className="border-primary/20">
        <CardContent className="p-4 flex items-center gap-3">
          <Shield className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Table Captain</p>
            <p className="text-xs text-muted-foreground">{profile.captain_sessions || 0} sessions captained</p>
          </div>
          <Button size="sm" variant="outline" onClick={async () => {
            setLoading(true);
            await supabase.from("profiles").update({ is_table_captain: false }).eq("id", user!.id);
            await refreshProfile();
            setLoading(false);
            toast.success("Stepped down as captain");
          }} disabled={loading}>Opt out</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-secondary/20 bg-secondary/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-secondary" />
          <p className="font-serif text-sm text-foreground">Become a Table Captain</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Captains help new members feel welcome and keep the session flowing. You don't run it — you nudge it. Read the icebreaker out loud, say 'deep work time', check on people during break.
        </p>
        <Button size="sm" onClick={async () => {
          setLoading(true);
          await supabase.from("profiles").update({ is_table_captain: true }).eq("id", user!.id);
          await refreshProfile();
          setLoading(false);
          toast.success("Welcome, Captain! 🫡");
        }} disabled={loading}>I'm in</Button>
      </CardContent>
    </Card>
  );
}

export function CaptainBadge() {
  return <Badge variant="outline" className="text-[10px] border-primary/30 text-primary gap-1"><Shield className="w-2.5 h-2.5" /> Captain</Badge>;
}
