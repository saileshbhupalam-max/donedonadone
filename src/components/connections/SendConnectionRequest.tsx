import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getInitials } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { trackConversion } from "@/lib/trackConversion";

interface SendConnectionRequestProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUser: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export function SendConnectionRequest({ open, onOpenChange, targetUser }: SendConnectionRequestProps) {
  const { user } = useAuth();
  const { tier, getLimit } = useSubscription();
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [weeklyCount, setWeeklyCount] = useState<number | null>(null);
  const [atLimit, setAtLimit] = useState(false);

  const weeklyLimit = getLimit("connections_per_week");

  useEffect(() => {
    if (!user || !open) return;
    if (weeklyLimit === -1) { setAtLimit(false); return; }
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    supabase
      .from("connection_requests")
      .select("id", { count: "exact", head: true })
      .eq("from_user", user.id)
      .gte("created_at", oneWeekAgo)
      .then(({ count }) => {
        const c = count || 0;
        setWeeklyCount(c);
        const isAtLimit = weeklyLimit > 0 && c >= weeklyLimit;
        setAtLimit(isAtLimit);
        if (isAtLimit) trackConversion("hit_limit", { limit: "connections_per_week" });
      });
  }, [user, open, weeklyLimit]);

  const handleSend = async () => {
    if (!user) return;
    setSending(true);

    const { error } = await supabase.from("connection_requests").insert({
      from_user: user.id,
      to_user: targetUser.id,
      message: message.trim() || null,
    });

    setSending(false);

    if (error) {
      if (error.code === "23505") {
        toast.info("You've already sent a request to this person");
      } else {
        toast.error("Couldn't send request. Try again.");
        console.error("[SendConnectionRequest]", error);
      }
    } else {
      toast.success("Request sent!");
      setMessage("");
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif">Connect</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2">
          <Avatar className="w-16 h-16">
            <AvatarImage src={targetUser.avatar_url || ""} />
            <AvatarFallback>{getInitials(targetUser.display_name)}</AvatarFallback>
          </Avatar>
          <p className="text-sm font-medium text-foreground">{targetUser.display_name || "Member"}</p>
        </div>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 200))}
          placeholder="Say something nice... (optional)"
          className="resize-none"
          rows={3}
        />
        <p className="text-[10px] text-muted-foreground text-right">{message.length}/200</p>

        {atLimit ? (
          <div className="space-y-2 text-center">
            <p className="text-sm text-foreground">You've used all {weeklyLimit} connection requests this week.</p>
            <p className="text-xs text-muted-foreground">Upgrade to Plus for unlimited connections.</p>
            <div className="flex gap-2 justify-center">
              <Button size="sm" onClick={() => { onOpenChange(false); navigate("/pricing"); }}>See Plans</Button>
              <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>OK</Button>
            </div>
          </div>
        ) : (
          <>
            <Button onClick={handleSend} disabled={sending} className="w-full">
              {sending ? "Sending..." : "Send Request"}
            </Button>
            {weeklyLimit > 0 && weeklyCount !== null && (
              <p className="text-[10px] text-muted-foreground text-center">
                {weeklyLimit - weeklyCount} of {weeklyLimit} connections remaining this week
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
