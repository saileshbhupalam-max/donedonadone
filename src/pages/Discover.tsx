import { useState, useEffect, useCallback, useReducer } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Sparkles, Link2, ChevronDown, ChevronUp, Building2, Users, Search, Lock, GraduationCap } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useConnections } from "@/hooks/useConnections";
import { SendConnectionRequest } from "@/components/connections/SendConnectionRequest";
import { usePageTitle } from "@/hooks/usePageTitle";
import { PersonalityLoader } from "@/components/ui/PersonalityLoader";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { getInitials } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MentorSection } from "@/components/discover/MentorSection";

interface LocationActivity {
  location_id: string;
  location_name: string;
  location_type: string;
  neighborhood: string | null;
  active_count: number;
  top_roles: string[];
}

interface WhosHerePerson {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  status: string;
  mode: string;
  note: string | null;
  checked_in_at: string;
  location_name: string | null;
  location_type: string | null;
  role_type: string | null;
  looking_for: string[] | null;
  skills: string[] | null;
  taste_match_score: number;
}

const locationTypeLabels: Record<string, string> = {
  cafe: "☕ Café",
  coworking_space: "🏢 Coworking",
  tech_park: "🏗️ Tech Park",
  neighborhood: "📍 Area",
};

const stageLabels: Record<string, string> = {
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

function ActiveLocationsSection() {
  const { user } = useAuth();
  const [locations, setLocations] = useState<LocationActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [locationPeople, setLocationPeople] = useState<WhosHerePerson[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [connectTarget, setConnectTarget] = useState<{ id: string; display_name: string | null; avatar_url: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("get_location_activity", { p_user_id: user.id }).then(({ data }) => {
      setLocations(data || []);
      setLoading(false);
    });
  }, [user]);

  const toggleExpand = async (locId: string) => {
    if (expandedId === locId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(locId);
    setLoadingPeople(true);
    const { data } = await supabase.rpc("get_whos_here", { p_user_id: user!.id, p_location_id: locId });
    setLocationPeople(data || []);
    setLoadingPeople(false);
  };

  const totalActive = locations.reduce((s, l) => s + Number(l.active_count), 0);

  if (loading) return <Skeleton className="h-24 mx-4" />;

  return (
    <section className="mt-2">
      <h2 className="font-serif text-lg px-4 mb-1 text-foreground flex items-center gap-2">
        <MapPin className="w-4 h-4 text-primary" /> Where people are working
      </h2>
      {totalActive > 0 && (
        <p className="text-xs text-muted-foreground px-4 mb-2">{totalActive} people checked in now</p>
      )}
      {locations.length === 0 ? (
        <Card className="mx-4"><CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground">It's quiet right now. Check in to be the first!</p>
        </CardContent></Card>
      ) : (
        <div className="px-4 space-y-2">
          {locations.map((loc) => (
            <Card key={loc.location_id} className="overflow-hidden">
              <button
                className="w-full text-left p-3 flex items-center gap-3"
                onClick={() => toggleExpand(loc.location_id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{loc.location_name}</p>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                      {locationTypeLabels[loc.location_type] || loc.location_type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{loc.active_count} {loc.active_count === 1 ? "person" : "people"} here</span>
                    {loc.top_roles.filter(Boolean).slice(0, 3).map((r) => (
                      <Badge key={r} variant="secondary" className="text-[9px] px-1.5 py-0 capitalize">{r}</Badge>
                    ))}
                  </div>
                </div>
                {expandedId === loc.location_id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
              {expandedId === loc.location_id && (
                <div className="border-t border-border px-3 pb-3">
                  {loadingPeople ? (
                    <div className="py-4 flex justify-center"><PersonalityLoader /></div>
                  ) : locationPeople.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-3 text-center">No one visible right now</p>
                  ) : (
                    <div className="space-y-2 pt-2">
                      {locationPeople.map((p) => (
                        <div key={p.user_id} className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={p.avatar_url || ""} />
                            <AvatarFallback className="text-[10px]">{getInitials(p.display_name)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{p.display_name}</p>
                            <div className="flex items-center gap-1.5">
                              {p.role_type && <span className="text-[10px] text-muted-foreground capitalize">{p.role_type}</span>}
                              {p.taste_match_score >= 60 && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 border-primary/30 text-primary">{p.taste_match_score}%</Badge>
                              )}
                            </div>
                          </div>
                          <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={(e) => { e.stopPropagation(); setConnectTarget({ id: p.user_id, display_name: p.display_name, avatar_url: p.avatar_url }); }}>
                            Connect
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      {connectTarget && (
        <SendConnectionRequest
          open={!!connectTarget}
          onOpenChange={(o) => !o && setConnectTarget(null)}
          targetUser={connectTarget}
        />
      )}
    </section>
  );
}

function SuggestedConnectionsSection() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState<WhosHerePerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectTarget, setConnectTarget] = useState<{ id: string; display_name: string | null; avatar_url: string | null } | null>(null);
  const [dnaComplete, setDnaComplete] = useState(100);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: tg } = await supabase.from("taste_graph").select("work_profile_complete").eq("user_id", user.id).maybeSingle();
      const completion = tg?.work_profile_complete ?? 0;
      setDnaComplete(completion);
      if (completion < 30) { setLoading(false); return; }

      const { data: people } = await supabase.rpc("get_whos_here", { p_user_id: user.id });
      if (!people || people.length === 0) { setSuggestions([]); setLoading(false); return; }

      const [{ data: conns }, { data: reqs }] = await Promise.all([
        supabase.from("connections").select("user_a, user_b").or(`user_a.eq.${user.id},user_b.eq.${user.id}`),
        supabase.from("connection_requests").select("from_user, to_user").or(`from_user.eq.${user.id},to_user.eq.${user.id}`),
      ]);

      const excludeIds = new Set<string>();
      (conns || []).forEach((c: any) => { excludeIds.add(c.user_a === user.id ? c.user_b : c.user_a); });
      (reqs || []).forEach((r: any) => { excludeIds.add(r.from_user === user.id ? r.to_user : r.from_user); });

      const filtered = (people as WhosHerePerson[])
        .filter((p) => !excludeIds.has(p.user_id))
        .sort((a, b) => b.taste_match_score - a.taste_match_score)
        .slice(0, 10);

      setSuggestions(filtered);
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) return <Skeleton className="h-20 mx-4 mt-5" />;

  if (dnaComplete < 30) {
    return (
      <section className="mt-5 px-4">
        <Card className="border-border/50 bg-muted/30">
          <CardContent className="p-4 text-center space-y-2">
            <Sparkles className="w-5 h-5 text-primary mx-auto" />
            <p className="text-sm font-medium text-foreground">Complete your Work DNA to get connection suggestions</p>
            <Button size="sm" variant="outline" onClick={() => navigate("/me/dna")}>Build your DNA</Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <section className="mt-5">
      <h2 className="font-serif text-lg px-4 mb-2 text-foreground flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" /> People you might click with
      </h2>
      <div className="px-4 space-y-2">
        {suggestions.map((p) => (
          <Card key={p.user_id} className="overflow-hidden">
            <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => navigate(`/profile/${p.user_id}`)}>
              <Avatar className="w-10 h-10">
                <AvatarImage src={p.avatar_url || ""} />
                <AvatarFallback className="text-xs">{getInitials(p.display_name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{p.display_name}</p>
                {p.role_type && <span className="text-[10px] text-muted-foreground capitalize">{p.role_type}</span>}
              </div>
              {p.taste_match_score >= 40 && (
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${p.taste_match_score >= 80 ? "border-primary/30 text-primary" : p.taste_match_score >= 60 ? "border-secondary/30 text-secondary" : "border-border"}`}>
                  {p.taste_match_score}%
                </Badge>
              )}
              <Button size="sm" variant="outline" className="text-[10px] h-7 shrink-0" onClick={(e) => { e.stopPropagation(); setConnectTarget({ id: p.user_id, display_name: p.display_name, avatar_url: p.avatar_url }); }}>
                Connect
              </Button>
            </div>
          </Card>
        ))}
      </div>
      {connectTarget && (
        <SendConnectionRequest
          open={!!connectTarget}
          onOpenChange={(o) => !o && setConnectTarget(null)}
          targetUser={connectTarget}
        />
      )}
    </section>
  );
}

function YourConnectionsSection() {
  const { connections, loading } = useConnections();
  const navigate = useNavigate();

  if (loading) return <Skeleton className="h-20 mx-4 mt-5" />;

  return (
    <section className="mt-5">
      <h2 className="font-serif text-lg px-4 mb-2 text-foreground flex items-center gap-2">
        <Link2 className="w-4 h-4 text-primary" /> Your connections
        <span className="text-sm font-sans font-normal text-muted-foreground">({connections.length})</span>
      </h2>
      {connections.length === 0 ? (
        <Card className="mx-4"><CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground">Your connections will appear here as you meet people</p>
        </CardContent></Card>
      ) : (
        <div className="px-4 space-y-2">
          {connections.map((c) => (
            <Card key={c.id} className="overflow-hidden">
              <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => navigate(`/profile/${c.user_id}`)}>
                <Avatar className="w-9 h-9">
                  <AvatarImage src={c.avatar_url || ""} />
                  <AvatarFallback className="text-xs">{getInitials(c.display_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{c.display_name || "Member"}</p>
                </div>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">{c.connection_type}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function CompanyDirectorySection() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { hasFeature } = useSubscription();
  const canSeeMatching = hasFeature("company_matching");
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null);
  const [matchingCompanyIds, setMatchingCompanyIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: allCompanies }, { data: membership }] = await Promise.all([
        supabase.from("companies").select("id, name, one_liner, stage, logo_url, industry_tags, team_size, created_at").order("created_at", { ascending: false }),
        supabase.from("company_members").select("company_id").eq("user_id", user.id).maybeSingle(),
      ]);

      setCompanies(allCompanies || []);
      const myCompanyId = membership?.company_id || null;
      setUserCompanyId(myCompanyId);

      // Get matches if user has a company
      if (myCompanyId) {
        const { data: matches } = await supabase.rpc("get_company_matches", { p_company_id: myCompanyId });
        if (matches) {
          setMatchingCompanyIds(new Set(matches.map((m: any) => m.matched_company_id)));
        }
      }

      setLoading(false);
    };
    load();
  }, [user]);

  const filtered = companies.filter((c) => {
    if (stageFilter !== "all" && c.stage !== stageFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const nameMatch = c.name.toLowerCase().includes(q);
      const tagMatch = (c.industry_tags || []).some((t) => t.toLowerCase().includes(q));
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

  if (loading) return <Skeleton className="h-40 mx-4 mt-2" />;

  return (
    <section className="mt-2">
      <div className="px-4 flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-28 h-9 text-xs">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {Object.entries(stageLabels).map(([val, label]) => (
              <SelectItem key={val} value={val}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {sorted.length === 0 ? (
        <Card className="mx-4">
          <CardContent className="py-6 text-center">
            <Building2 className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No companies found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="px-4 space-y-2">
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
                      <img src={c.logo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                      {canSeeMatching && matchingCompanyIds.has(c.id) && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-green-500/30 text-green-600 shrink-0">
                          <Sparkles className="w-2.5 h-2.5 mr-0.5" /> Match
                        </Badge>
                      )}
                      {!canSeeMatching && matchingCompanyIds.has(c.id) && (
                        <span className="text-[9px] text-muted-foreground flex items-center gap-0.5 shrink-0">
                          <Lock className="w-2.5 h-2.5" /> Pro
                        </span>
                      )}
                    </div>
                    {c.one_liner && (
                      <p className="text-[11px] text-muted-foreground truncate">{c.one_liner}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {c.stage && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                          {stageLabels[c.stage] || c.stage}
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Users className="w-3 h-3" /> {c.team_size || 1}
                      </span>
                      {(c.industry_tags || []).slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[8px] px-1 py-0">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!userCompanyId && (
        <div className="px-4 mt-3">
          <Card className="border-dashed border-primary/30">
            <CardContent className="p-4 text-center space-y-2">
              <p className="text-xs text-muted-foreground">Add your company to unlock B2B matchmaking</p>
              <Button size="sm" variant="outline" onClick={() => navigate("/company/create")}>
                <Building2 className="w-3.5 h-3.5 mr-1" /> Create Company
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}

export default function Discover() {
  usePageTitle("Discover — FocusClub");
  // Incrementing refreshKey forces sub-components to remount and re-fetch their data
  const [refreshKey, incrementRefreshKey] = useReducer((c: number) => c + 1, 0);

  const handleRefresh = useCallback(async () => {
    incrementRefreshKey();
  }, []);

  return (
    <AppShell>
      <PullToRefresh onRefresh={handleRefresh}>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="pb-6"
        >
          <div className="px-4 pt-4 pb-2">
            <h1 className="font-serif text-2xl text-foreground">Discover</h1>
            <p className="text-xs text-muted-foreground mt-0.5">See who's around and find your people</p>
          </div>

          <Tabs defaultValue="people" className="px-4 mb-2">
            <TabsList className="w-full">
              <TabsTrigger value="people" className="flex-1 text-xs">
                <Users className="w-3.5 h-3.5 mr-1" /> People
              </TabsTrigger>
              <TabsTrigger value="companies" className="flex-1 text-xs">
                <Building2 className="w-3.5 h-3.5 mr-1" /> Companies
              </TabsTrigger>
            </TabsList>

            <TabsContent value="people" className="mt-0 -mx-4">
              <ActiveLocationsSection key={`locations-${refreshKey}`} />
              <SuggestedConnectionsSection key={`suggestions-${refreshKey}`} />
              <MentorSection key={`mentors-${refreshKey}`} />
              <YourConnectionsSection key={`connections-${refreshKey}`} />
            </TabsContent>

            <TabsContent value="companies" className="mt-0 -mx-4">
              <div className="px-4 py-2">
                <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => navigate("/companies")}>
                  <Building2 className="w-3 h-3 mr-1.5" /> View Full Company Directory
                </Button>
              </div>
              <CompanyDirectorySection key={`companies-${refreshKey}`} />
            </TabsContent>
          </Tabs>
        </motion.div>
      </PullToRefresh>
    </AppShell>
  );
}
