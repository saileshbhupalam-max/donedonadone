import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ShareProfileCard } from "@/components/sharing/ProfileCard";
import { CopyLinkButton } from "@/components/sharing/WhatsAppButton";
import { Share2, Download, MessageCircle } from "lucide-react";

// ─── Share Card Section ──────────────────────────────────
export function ShareCardSection({ profile, referralCode }: { profile: any; referralCode?: string | null }) {
  const [propCounts, setPropCounts] = useState<Record<string, number>>({});
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const profileLink = `${appUrl}/profile/${profile.id}${referralCode ? `?ref=${referralCode}` : ""}`;

  useEffect(() => {
    supabase.from("peer_props").select("prop_type").eq("to_user", profile.id)
      .then(({ data }: any) => {
        if (!data) return;
        const counts: Record<string, number> = {};
        data.forEach((r: any) => { counts[r.prop_type] = (counts[r.prop_type] || 0) + 1; });
        setPropCounts(counts);
      });
  }, [profile.id]);

  const { handleShare, handleWhatsApp, handleCopy, handleDownload, generating } = ShareProfileCard({
    profile, propCounts, streak: profile.current_streak || 0, referralCode,
  });

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-foreground">Share Your Card</h3>
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" onClick={handleShare} disabled={generating} className="gap-2">
          <Share2 className="w-3.5 h-3.5" /> {generating ? "..." : "Share"}
        </Button>
        <Button size="sm" variant="default" onClick={handleWhatsApp} disabled={generating} className="gap-2 bg-[#25D366] hover:bg-[#20BD5A]">
          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
        </Button>
        <CopyLinkButton link={profileLink} label="Copy Link" size="sm" />
        <Button size="sm" variant="outline" onClick={handleDownload} disabled={generating} className="gap-2">
          <Download className="w-3.5 h-3.5" /> Download
        </Button>
      </div>
    </div>
  );
}
