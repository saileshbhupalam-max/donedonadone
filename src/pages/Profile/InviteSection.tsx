import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WhatsAppShareButton } from "@/components/sharing/WhatsAppButton";
import { getInitials } from "@/lib/utils";
import { toast as sonnerToast } from "sonner";

// ─── Invite Section ──────────────────────────────────────
export function InviteSection({ userId, referralCode }: { userId?: string; referralCode?: string | null }) {
  const [referralCount, setReferralCount] = useState(0);
  const [referrals, setReferrals] = useState<Array<{ id: string; display_name: string | null; avatar_url: string | null }>>([]);
  const appUrl = window.location.origin;
  const code = referralCode || userId?.replace(/-/g, "").slice(0, 8) || "";
  const inviteLink = `${appUrl}/invite/${code}`;

  useEffect(() => {
    if (!userId) return;
    supabase.from("profiles").select("id, display_name, avatar_url", { count: "exact" })
      .eq("referred_by", userId)
      .then(({ count, data }) => { setReferralCount(count || 0); setReferrals(data || []); });
  }, [userId]);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-foreground">Invite your people</h3>
      {referralCount > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-foreground font-medium">{referralCount} {referralCount === 1 ? "person" : "people"} joined through your link 🎉</p>
          <div className="flex -space-x-2">
            {referrals.slice(0, 8).map(r => (
              <Avatar key={r.id} className="w-8 h-8 border-2 border-background">
                <AvatarImage src={r.avatar_url || ""} />
                <AvatarFallback className="text-[10px] bg-muted">{getInitials(r.display_name)}</AvatarFallback>
              </Avatar>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <Input value={inviteLink} readOnly className="text-xs flex-1" />
        <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(inviteLink); sonnerToast.success("Link copied!"); }}>Copy</Button>
      </div>
      <WhatsAppShareButton message={`Hey! I've been coworking with people at cafes through DanaDone — it's way better than working alone. Join me: ${inviteLink}`} label="Share on WhatsApp" fullWidth />
    </div>
  );
}
