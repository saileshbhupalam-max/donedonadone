import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Building2, ArrowRight, Sparkles, Send, Lock } from "lucide-react";
import { trackConversion } from "@/lib/trackConversion";
import { AIIntroDraft } from "@/components/company/AIIntroDraft";

const STAGE_LABELS: Record<string, string> = {
  idea: "Idea", pre_seed: "Pre-seed", seed: "Seed", series_a: "Series A",
  series_b_plus: "Series B+", bootstrapped: "Bootstrapped", profitable: "Profitable",
  agency: "Agency", freelancer: "Freelancer",
};

interface Match {
  matched_company_id: string;
  company_name: string;
  company_one_liner: string | null;
  company_stage: string | null;
  company_logo_url: string | null;
  match_type: string;
  your_need_title: string | null;
  their_offer_title: string | null;
  their_need_title: string | null;
  your_offer_title: string | null;
}

function IntroDialog({ fromCompanyId, toCompanyId, toCompanyName, onSent, introState }: {
  fromCompanyId: string; toCompanyId: string; toCompanyName: string; onSent: () => void;
  introState: { allowed: boolean; useCredit: boolean; remaining: number; limit: number; credits: number; blocked: boolean; zeroLimit: boolean };
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  if (introState.zeroLimit) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="w-3 h-3" />
          <span>Company intros are a Pro feature.</span>
        </div>
        <Button size="sm" variant="outline" className="text-xs" onClick={() => { trackConversion("clicked_upgrade", { from: "company_intro_gate" }); navigate("/pricing"); }}>
          Upgrade to send intros
        </Button>
      </div>
    );
  }

  if (introState.blocked) {
    return (
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">
          You've used all {introState.limit} intros this month.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="text-xs" onClick={() => { trackConversion("clicked_upgrade", { from: "company_intro_limit" }); navigate("/pricing"); }}>
            See Plans
          </Button>
          <Button size="sm" variant="ghost" className="text-xs" onClick={() => toast.info("Coming soon!")}>
            Buy Credits
          </Button>
        </div>
      </div>
    );
  }

  const handleSend = async () => {
    if (!user) return;
    setSending(true);
    const { error } = await supabase.from("company_intros").insert({
      from_company_id: fromCompanyId,
      to_company_id: toCompanyId,
      from_user_id: user.id,
      message: message.trim() || null,
    });
    if (error) {
      setSending(false);
      toast.error(error.code === "23505" ? "Intro already sent" : "Failed to send intro");
      return;
    }

    // Decrement credit if used
    if (introState.useCredit) {
      await supabase
        .from("intro_credits")
        .update({ credits_remaining: introState.credits - 1 })
        .eq("user_id", user.id);
    }

    setSending(false);
    toast.success("Intro sent!");
    setOpen(false);
    setMessage("");
    onSent();
  };

  return (
    <div className="space-y-1">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="gap-1.5">
            <Send className="w-3.5 h-3.5" /> Introduce
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Introduce yourself to {toCompanyName}</DialogTitle>
          </DialogHeader>
           <div className="space-y-4">
             <Textarea
               placeholder="Hi! We'd love to explore how we could work together..."
               value={message}
               onChange={(e) => setMessage(e.target.value.slice(0, 500))}
               maxLength={500}
               className="min-h-[80px]"
             />
             <div className="flex items-center justify-between">
               <AIIntroDraft
                 fromCompanyId={fromCompanyId}
                 toCompanyId={toCompanyId}
                 onDraft={(text) => setMessage(text)}
               />
               <p className="text-[10px] text-muted-foreground">{message.length}/500</p>
             </div>
            <Button className="w-full" onClick={handleSend} disabled={sending}>
              {sending ? "Sending..." : "Send Intro"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {introState.useCredit ? (
        <p className="text-[10px] text-muted-foreground">Using intro credit ({introState.credits} remaining)</p>
      ) : introState.limit > 0 && introState.limit !== -1 ? (
        <p className="text-[10px] text-muted-foreground">{introState.remaining} of {introState.limit} intros remaining this month</p>
      ) : null}
    </div>
  );
}

function MatchCard({ match, myCompanyId, onIntroSent, introState }: {
  match: Match; myCompanyId: string; onIntroSent: () => void;
  introState: { allowed: boolean; useCredit: boolean; remaining: number; limit: number; credits: number; blocked: boolean; zeroLimit: boolean };
}) {
  const navigate = useNavigate();
  const isTheyOffer = match.match_type === "they_offer_you_need";

  return (
    <div className="p-3 rounded-lg border border-border space-y-2">
      <div className="flex items-start gap-3">
        <button onClick={() => navigate(`/company/${match.matched_company_id}`)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            {match.company_logo_url ? (
              <img src={match.company_logo_url} alt="" className="w-7 h-7 rounded object-cover" />
            ) : (
              <Building2 className="w-4 h-4 text-primary" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{match.company_name}</p>
            {match.company_one_liner && (
              <p className="text-[11px] text-muted-foreground truncate">{match.company_one_liner}</p>
            )}
          </div>
        </button>
        {match.company_stage && (
          <Badge variant="outline" className="text-[9px] flex-shrink-0">{STAGE_LABELS[match.company_stage] || match.company_stage}</Badge>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs px-1">
        {isTheyOffer ? (
          <>
            <Badge variant="secondary" className="text-[10px]">They offer: {match.their_offer_title}</Badge>
            <ArrowRight className="w-3 h-3 text-muted-foreground" />
            <Badge className="text-[10px]">You need: {match.your_need_title}</Badge>
          </>
        ) : (
          <>
            <Badge className="text-[10px]">You offer: {match.your_offer_title}</Badge>
            <ArrowRight className="w-3 h-3 text-muted-foreground" />
            <Badge variant="secondary" className="text-[10px]">They need: {match.their_need_title}</Badge>
          </>
        )}
      </div>

      <IntroDialog
        fromCompanyId={myCompanyId}
        toCompanyId={match.matched_company_id}
        toCompanyName={match.company_name}
        onSent={onIntroSent}
        introState={introState}
      />
    </div>
  );
}

export function CompanyMatches({ companyId }: { companyId: string }) {
  const { user } = useAuth();
  const { getLimit } = useSubscription();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthlyUsed, setMonthlyUsed] = useState(0);
  const [credits, setCredits] = useState(0);

  const fetchMatches = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_company_matches", { p_company_id: companyId });
    if (!error && data) setMatches(data as Match[]);

    if (user) {
      const firstOfMonth = new Date();
      firstOfMonth.setDate(1);
      firstOfMonth.setHours(0, 0, 0, 0);

      const [{ count }, { data: creditData }] = await Promise.all([
        supabase
          .from("company_intros")
          .select("id", { count: "exact", head: true })
          .eq("from_user_id", user.id)
          .gte("created_at", firstOfMonth.toISOString()),
        supabase
          .from("intro_credits")
          .select("credits_remaining")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      setMonthlyUsed(count || 0);
      setCredits(creditData?.credits_remaining || 0);
    }
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchMatches(); }, [companyId]);

  const monthlyLimit = getLimit("company_intros_per_month");

  const introState = (() => {
    const zeroLimit = monthlyLimit === 0;
    const unlimited = monthlyLimit === -1;
    const remaining = unlimited ? Infinity : Math.max(0, monthlyLimit - monthlyUsed);
    const atLimit = !unlimited && remaining <= 0;
    const useCredit = atLimit && credits > 0;
    const blocked = atLimit && credits <= 0;
    const allowed = unlimited || remaining > 0 || useCredit;
    return { allowed, useCredit, remaining: unlimited ? -1 : remaining, limit: monthlyLimit, credits, blocked, zeroLimit };
  })();

  const theyOffer = matches.filter((m) => m.match_type === "they_offer_you_need");
  const youOffer = matches.filter((m) => m.match_type === "you_offer_they_need");

  if (loading) return null;
  if (matches.length === 0) {
    return (
      <Card>
        <CardContent className="pt-5 space-y-2">
          <h2 className="font-serif text-base text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Business Matches
          </h2>
          <p className="text-xs text-muted-foreground">No matches yet. Add needs and offers to discover complementary companies.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <h2 className="font-serif text-base text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" /> Business Matches ({matches.length})
        </h2>

        {theyOffer.length > 0 && (
          <>
            <p className="text-xs font-medium text-foreground">They have what you need</p>
            {theyOffer.map((m, i) => (
              <MatchCard key={`to-${i}`} match={m} myCompanyId={companyId} onIntroSent={fetchMatches} introState={introState} />
            ))}
          </>
        )}

        {theyOffer.length > 0 && youOffer.length > 0 && <Separator />}

        {youOffer.length > 0 && (
          <>
            <p className="text-xs font-medium text-foreground">You have what they need</p>
            {youOffer.map((m, i) => (
              <MatchCard key={`yo-${i}`} match={m} myCompanyId={companyId} onIntroSent={fetchMatches} introState={introState} />
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
