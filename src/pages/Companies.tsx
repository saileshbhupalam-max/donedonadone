import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  Search,
  Users,
  Sparkles,
  ArrowRight,
  Lock,
  Handshake,
  Briefcase,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { CompanyMatches } from "@/components/company/CompanyMatches";

const STAGE_LABELS: Record<string, string> = {
  idea: "Idea",
  pre_seed: "Pre-seed",
  seed: "Seed",
  series_a: "Series A",
  series_b_plus: "Series B+",
  bootstrapped: "Bootstrapped",
  profitable: "Profitable",
  agency: "Agency",
  freelancer: "Freelancer",
};

const STAGE_OPTIONS = Object.entries(STAGE_LABELS);

interface CompanyRow {
  id: string;
  name: string;
  one_liner: string | null;
  stage: string | null;
  logo_url: string | null;
  industry_tags: string[] | null;
  team_size: number | null;
  created_at: string;
}

export default function Companies() {
  usePageTitle("Companies -- DanaDone");
  const { user } = useAuth();
  const navigate = useNavigate();
  const { hasFeature } = useSubscription();
  const canSeeMatching = hasFeature("company_matching");

  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null);
  const [matchingCompanyIds, setMatchingCompanyIds] = useState<Set<string>>(
    new Set()
  );

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [{ data: allCompanies }, { data: membership }] = await Promise.all([
      supabase
        .from("companies")
        .select(
          "id, name, one_liner, stage, logo_url, industry_tags, team_size, created_at"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    setCompanies(allCompanies || []);
    const myCompanyId = membership?.company_id || null;
    setUserCompanyId(myCompanyId);

    if (myCompanyId) {
      const { data: matches } = await supabase.rpc("get_company_matches", {
        p_company_id: myCompanyId,
      });
      if (matches) {
        setMatchingCompanyIds(
          new Set(matches.map((m: any) => m.matched_company_id))
        );
      }
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = companies.filter((c) => {
    if (stageFilter && c.stage !== stageFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const nameMatch = c.name.toLowerCase().includes(q);
      const tagMatch = (c.industry_tags || []).some((t) =>
        t.toLowerCase().includes(q)
      );
      if (!nameMatch && !tagMatch) return false;
    }
    return true;
  });

  // Sort: matches first, then by created_at
  const sorted = [...filtered].sort((a, b) => {
    const aMatch = matchingCompanyIds.has(a.id) ? 1 : 0;
    const bMatch = matchingCompanyIds.has(b.id) ? 1 : 0;
    if (bMatch !== aMatch) return bMatch - aMatch;
    return (b.created_at || "").localeCompare(a.created_at || "");
  });

  return (
    <AppShell>
      <PullToRefresh onRefresh={fetchData}>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="pb-6"
        >
          {/* Header */}
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              <h1 className="font-serif text-2xl text-foreground">
                Company Directory
              </h1>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Discover companies, find business matches, and grow together
            </p>
          </div>

          {/* Search */}
          <div className="px-4 mt-2 mb-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by company name or industry..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>

          {/* Stage filter chips */}
          <div className="px-4 mb-4">
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => setStageFilter(null)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  !stageFilter
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              {STAGE_OPTIONS.map(([val, label]) => (
                <button
                  key={val}
                  onClick={() =>
                    setStageFilter(stageFilter === val ? null : val)
                  }
                  className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                    stageFilter === val
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="px-4 space-y-3">
              <Skeleton className="h-32" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : (
            <>
              {/* Matches section (if user has a company) */}
              {userCompanyId && (
                <section className="px-4 mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Handshake className="w-4 h-4 text-primary" />
                    <h2 className="font-serif text-lg text-foreground">
                      Matches for Your Company
                    </h2>
                  </div>
                  <CompanyMatches companyId={userCompanyId} />
                </section>
              )}

              {/* Separator between matches and directory */}
              {userCompanyId && sorted.length > 0 && (
                <div className="px-4 mb-4">
                  <Separator />
                </div>
              )}

              {/* All Companies directory */}
              <section className="px-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-serif text-lg text-foreground flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" /> All Companies
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {sorted.length} {sorted.length === 1 ? "company" : "companies"}
                  </span>
                </div>

                {sorted.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <Building2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">
                        {search || stageFilter
                          ? "No companies match your filters"
                          : "No companies registered yet"}
                      </p>
                      {(search || stageFilter) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mt-2 text-xs"
                          onClick={() => {
                            setSearch("");
                            setStageFilter(null);
                          }}
                        >
                          Clear filters
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {sorted.map((c) => (
                      <Card
                        key={c.id}
                        className="overflow-hidden cursor-pointer hover:shadow-sm transition-shadow"
                        onClick={() => navigate(`/company/${c.id}`)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                              {c.logo_url ? (
                                <img
                                  src={c.logo_url}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Building2 className="w-5 h-5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {c.name}
                                </p>
                                {canSeeMatching &&
                                  matchingCompanyIds.has(c.id) && (
                                    <Badge
                                      variant="outline"
                                      className="text-[9px] px-1 py-0 border-green-500/30 text-green-600 shrink-0"
                                    >
                                      <Sparkles className="w-2.5 h-2.5 mr-0.5" />{" "}
                                      Match
                                    </Badge>
                                  )}
                                {!canSeeMatching &&
                                  matchingCompanyIds.has(c.id) && (
                                    <span className="text-[9px] text-muted-foreground flex items-center gap-0.5 shrink-0">
                                      <Lock className="w-2.5 h-2.5" /> Pro
                                    </span>
                                  )}
                              </div>
                              {c.one_liner && (
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {c.one_liner}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                {c.stage && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] px-1 py-0"
                                  >
                                    {STAGE_LABELS[c.stage] || c.stage}
                                  </Badge>
                                )}
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                  <Users className="w-3 h-3" />{" "}
                                  {c.team_size || 1}
                                </span>
                                {(c.industry_tags || [])
                                  .slice(0, 2)
                                  .map((tag) => (
                                    <Badge
                                      key={tag}
                                      variant="secondary"
                                      className="text-[8px] px-1 py-0"
                                    >
                                      {tag}
                                    </Badge>
                                  ))}
                              </div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>

              {/* Register CTA for non-company users */}
              {!userCompanyId && (
                <div className="px-4 mt-5">
                  <Card className="border-dashed border-primary/30 bg-primary/5">
                    <CardContent className="p-5 text-center space-y-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Register your company
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Unlock B2B matchmaking, find partners, and grow your
                          business through the DanaDone network
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => navigate("/company/create")}
                      >
                        <Building2 className="w-3.5 h-3.5 mr-1.5" /> Create
                        Company Profile
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </motion.div>
      </PullToRefresh>
    </AppShell>
  );
}
