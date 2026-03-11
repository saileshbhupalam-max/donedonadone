import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { FeatureGate } from "@/components/FeatureGate";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Sparkles, Users, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface CompanyHere {
  company_id: string;
  company_name: string;
  company_one_liner: string | null;
  company_stage: string | null;
  company_logo_url: string | null;
  industry_tags: string[] | null;
  member_count: number;
  members_here: number;
  has_matching_needs: boolean;
}

const stageLabels: Record<string, string> = {
  idea: "Idea", pre_seed: "Pre-seed", seed: "Seed", series_a: "Series A",
  series_b_plus: "Series B+", bootstrapped: "Bootstrapped", profitable: "Profitable",
  agency: "Agency", freelancer: "Freelancer",
};

function CompaniesHereInner() {
  const { user } = useAuth();
  const { hasFeature } = useSubscription();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<CompanyHere[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasCompany, setHasCompany] = useState<boolean | null>(null);

  const canSeeMatching = hasFeature("company_matching");

  const fetchCompanies = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();
    setHasCompany(!!membership);

    const { data } = await supabase.rpc("get_companies_here", {
      p_user_id: user.id,
    });
    setCompanies(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchCompanies();
    const interval = setInterval(fetchCompanies, 60000);
    return () => clearInterval(interval);
  }, [fetchCompanies]);

  if (!loading && companies.length === 0 && hasCompany) return null;
  if (loading) return null;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5" /> Companies Here
        </p>

        {companies.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            {companies.map((c) => (
              <div
                key={c.company_id}
                className="shrink-0 w-48 rounded-lg border border-border bg-background p-3 cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => navigate(`/company/${c.company_id}`)}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {c.company_logo_url ? (
                      <img src={c.company_logo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-muted-foreground">
                        {c.company_name?.[0]?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{c.company_name}</p>
                    {c.company_stage && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0">
                        {stageLabels[c.company_stage] || c.company_stage}
                      </Badge>
                    )}
                  </div>
                </div>

                {canSeeMatching && c.company_one_liner && (
                  <p className="text-[10px] text-muted-foreground truncate mb-1.5">{c.company_one_liner}</p>
                )}

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Users className="w-3 h-3" /> {c.members_here} here
                  </span>
                  {canSeeMatching && c.has_matching_needs && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-green-500/30 text-green-600">
                      <Sparkles className="w-2.5 h-2.5 mr-0.5" /> Match
                    </Badge>
                  )}
                  {!canSeeMatching && c.has_matching_needs && (
                    <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" /> Pro
                    </span>
                  )}
                </div>

                {canSeeMatching && c.industry_tags && c.industry_tags.length > 0 && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {c.industry_tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[8px] px-1 py-0">{tag}</Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : !hasCompany ? (
          <div className="text-center py-2 space-y-2">
            <p className="text-xs text-muted-foreground">
              Create your company profile to discover business opportunities
            </p>
            <Button size="sm" variant="outline" className="text-xs" onClick={() => navigate("/company/create")}>
              <Building2 className="w-3.5 h-3.5 mr-1" /> Create Company
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function CompaniesHere() {
  return (
    <FeatureGate requireCheckIn>
      <CompaniesHereInner />
    </FeatureGate>
  );
}
