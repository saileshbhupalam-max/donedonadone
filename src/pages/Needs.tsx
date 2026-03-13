import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useUserContext } from "@/hooks/useUserContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import { supabase } from "@/integrations/supabase/client";
import {
  scoreNeedForUser,
  parseNeedMeta,
  isOffer,
  NEED_CATEGORIES,
  BUDGET_OPTIONS,
  DURATION_OPTIONS,
  type NeedMatch,
} from "@/lib/needsMatch";
import { getInitials } from "@/lib/utils";
import { CreateNeedDialog } from "@/components/needs/CreateNeedDialog";
import { RespondToNeedDialog } from "@/components/needs/RespondToNeedDialog";
import { FeatureGate, FeatureGateUpgradeCard } from "@/components/FeatureGate";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Briefcase,
  HandHelping,
  Plus,
  Clock,
  DollarSign,
  Tag,
  Sparkles,
  CheckCircle2,
  Trash2,
  Pencil,
  Loader2,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type TasteGraph = Tables<"taste_graph">;

interface NeedItem {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  request_type: string;
  status: string;
  claimed_by: string | null;
  location_id: string | null;
  expires_at: string;
  created_at: string;
  profiles?: { display_name: string | null; avatar_url: string | null } | null;
}

function NeedCard({
  need,
  matchInfo,
  showActions,
  onRespond,
  onComplete,
  onDelete,
}: {
  need: NeedItem;
  matchInfo?: NeedMatch;
  showActions?: "respond" | "manage";
  onRespond?: (need: NeedItem) => void;
  onComplete?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const { text, meta } = parseNeedMeta(need.description);
  const needIsOffer = isOffer(need.title, need.description);
  const category = NEED_CATEGORIES[need.request_type] || NEED_CATEGORIES.other;
  const budgetLabel = BUDGET_OPTIONS.find(b => b.value === meta.budget)?.label;
  const durationLabel = DURATION_OPTIONS.find(d => d.value === meta.duration)?.label;

  return (
    <Card className="border-border/50 hover:border-border transition-colors">
      <CardContent className="p-4 space-y-3">
        {/* Header: type badge + category + time */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge
              variant="outline"
              className={needIsOffer
                ? "text-[10px] border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                : "text-[10px] border-blue-500/30 bg-blue-500/5 text-blue-600 dark:text-blue-400"
              }
            >
              {needIsOffer ? (
                <><HandHelping className="w-3 h-3 mr-0.5" /> Offer</>
              ) : (
                <><Briefcase className="w-3 h-3 mr-0.5" /> Need</>
              )}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">{category.label}</Badge>
            {need.status !== "open" && (
              <Badge
                variant={need.status === "completed" ? "default" : "outline"}
                className="text-[10px] capitalize"
              >
                {need.status}
              </Badge>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {formatDistanceToNow(new Date(need.created_at), { addSuffix: true })}
          </span>
        </div>

        {/* Title + description */}
        <div>
          <h3 className="text-sm font-medium text-foreground leading-snug">{need.title}</h3>
          {text && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{text}</p>
          )}
        </div>

        {/* Meta: budget, duration, skills */}
        {(budgetLabel || durationLabel || (meta.skills && meta.skills.length > 0)) && (
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-2">
              {budgetLabel && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
                  <DollarSign className="w-3 h-3" /> {budgetLabel}
                </span>
              )}
              {durationLabel && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
                  <Clock className="w-3 h-3" /> {durationLabel}
                </span>
              )}
            </div>
            {meta.skills && meta.skills.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {meta.skills.map(skill => (
                  <Badge key={skill} variant="secondary" className="text-[10px] font-normal">
                    <Tag className="w-2.5 h-2.5 mr-0.5" />
                    {skill}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Match score (when in matching tab) */}
        {matchInfo && matchInfo.matchScore > 0 && (
          <div className="rounded-md bg-primary/5 border border-primary/10 p-2 space-y-1">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-medium text-primary">{matchInfo.matchScore}% match</span>
            </div>
            {matchInfo.matchReasons.map((reason, i) => (
              <p key={i} className="text-[10px] text-muted-foreground pl-4.5">
                {reason}
              </p>
            ))}
          </div>
        )}

        {/* Posted by + action */}
        <div className="flex items-center justify-between pt-1">
          {need.profiles ? (
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="w-5 h-5">
                {need.profiles.avatar_url && (
                  <AvatarImage src={need.profiles.avatar_url} />
                )}
                <AvatarFallback className="text-[8px]">
                  {getInitials(need.profiles.display_name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-[10px] text-muted-foreground truncate">
                {need.profiles.display_name || "Anonymous"}
              </span>
            </div>
          ) : (
            <div />
          )}

          {showActions === "respond" && need.status === "open" && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7"
              onClick={() => onRespond?.(need)}
            >
              {needIsOffer ? "I'm Interested" : "I Can Help"}
            </Button>
          )}

          {showActions === "manage" && (
            <div className="flex items-center gap-1.5">
              {need.status === "claimed" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7"
                  onClick={() => onComplete?.(need.id)}
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Complete
                </Button>
              )}
              {(need.status === "open" || need.status === "claimed") && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7 text-destructive hover:text-destructive"
                  onClick={() => onDelete?.(need.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Needs() {
  usePageTitle("Needs Board -- FocusClub");
  const { user, profile } = useAuth();
  const { getLimit, tier } = useSubscription();
  const { activeCheckIn } = useUserContext();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = searchParams.get("tab") || "all";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "relevant">("newest");

  const [allNeeds, setAllNeeds] = useState<NeedItem[]>([]);
  const [myPosts, setMyPosts] = useState<NeedItem[]>([]);
  const [tasteGraph, setTasteGraph] = useState<TasteGraph | null>(null);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [respondNeed, setRespondNeed] = useState<NeedItem | null>(null);

  const activeLimit = getLimit("micro_requests_active");
  const effectiveLimit = activeLimit > 0 ? activeLimit : (activeLimit === -1 ? 999 : 1);

  const fetchAll = useCallback(async () => {
    if (!user) return;

    const [othersRes, mineRes, tgRes] = await Promise.all([
      supabase
        .from("micro_requests")
        .select("*, profiles:user_id(display_name, avatar_url)")
        .eq("status", "open")
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("micro_requests")
        .select("*, profiles:user_id(display_name, avatar_url)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("taste_graph")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    setAllNeeds((othersRes.data as unknown as NeedItem[]) || []);
    setMyPosts((mineRes.data as unknown as NeedItem[]) || []);
    setTasteGraph(tgRes.data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Compute match scores for all needs
  const matchScores = useMemo(() => {
    if (!profile) return new Map<string, NeedMatch>();
    const map = new Map<string, NeedMatch>();
    for (const need of allNeeds) {
      const match = scoreNeedForUser(need, profile, tasteGraph);
      map.set(need.id, match);
    }
    return map;
  }, [allNeeds, profile, tasteGraph]);

  // Filter + sort all needs
  const filteredNeeds = useMemo(() => {
    let filtered = allNeeds.filter(n => n.user_id !== user?.id);

    if (categoryFilter !== "all") {
      filtered = filtered.filter(n => n.request_type === categoryFilter);
    }

    if (sortBy === "relevant") {
      filtered.sort((a, b) => {
        const scoreA = matchScores.get(a.id)?.matchScore ?? 0;
        const scoreB = matchScores.get(b.id)?.matchScore ?? 0;
        return scoreB - scoreA;
      });
    }
    // "newest" is default from the API

    return filtered;
  }, [allNeeds, user?.id, categoryFilter, sortBy, matchScores]);

  // Matching needs: only those with a meaningful match score
  const matchingNeeds = useMemo(() => {
    if (!profile) return [];
    return allNeeds
      .filter(n => n.user_id !== user?.id)
      .map(n => ({ need: n, match: matchScores.get(n.id)! }))
      .filter(({ match }) => match && match.matchScore >= 20)
      .sort((a, b) => b.match.matchScore - a.match.matchScore);
  }, [allNeeds, user?.id, profile, matchScores]);

  const handleComplete = async (id: string) => {
    const { error } = await supabase
      .from("micro_requests")
      .update({ status: "completed" })
      .eq("id", id);
    if (error) {
      toast.error("Failed to complete");
      return;
    }
    toast.success("Marked as complete!");
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("micro_requests")
      .delete()
      .eq("id", id)
      .eq("user_id", user?.id || "");
    if (error) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Deleted");
    fetchAll();
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams(tab === "all" ? {} : { tab });
  };

  const openCount = myPosts.filter(r => r.status === "open").length;
  const atLimit = openCount >= effectiveLimit;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-serif font-semibold text-foreground">Needs Board</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Post what you need or offer to the community
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            disabled={atLimit}
          >
            <Plus className="w-4 h-4 mr-1" /> Post
          </Button>
        </div>

        {atLimit && tier === "free" && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 rounded-lg p-2.5">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>Free tier: {effectiveLimit} active post{effectiveLimit === 1 ? "" : "s"}. Upgrade for more.</span>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">All Needs</TabsTrigger>
            <TabsTrigger value="matching" className="flex-1">
              Matching You
              {matchingNeeds.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 min-w-4 px-1">
                  {matchingNeeds.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="yours" className="flex-1">Your Posts</TabsTrigger>
          </TabsList>

          {/* ===== ALL NEEDS TAB ===== */}
          <TabsContent value="all" className="space-y-3 mt-3">
            {/* Filters */}
            <div className="flex gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-8 text-xs w-[140px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {Object.entries(NEED_CATEGORIES).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={v => setSortBy(v as "newest" | "relevant")}>
                <SelectTrigger className="h-8 text-xs w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="relevant">Most Relevant</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-32 rounded-lg" />
                ))}
              </div>
            ) : filteredNeeds.length === 0 ? (
              <Card className="border-border/50">
                <CardContent className="p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    {categoryFilter !== "all"
                      ? "No needs in this category yet. Be the first to post!"
                      : "No open needs right now. Post one to get started!"}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => setCreateOpen(true)}
                    disabled={atLimit}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Post a Need
                  </Button>
                </CardContent>
              </Card>
            ) : (
              filteredNeeds.map(need => (
                <NeedCard
                  key={need.id}
                  need={need}
                  matchInfo={sortBy === "relevant" ? matchScores.get(need.id) : undefined}
                  showActions="respond"
                  onRespond={setRespondNeed}
                />
              ))
            )}
          </TabsContent>

          {/* ===== MATCHING TAB ===== */}
          <TabsContent value="matching" className="space-y-3 mt-3">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-36 rounded-lg" />
                ))}
              </div>
            ) : matchingNeeds.length === 0 ? (
              <Card className="border-border/50">
                <CardContent className="p-8 text-center space-y-2">
                  <Sparkles className="w-8 h-8 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    No strong matches right now. Complete your profile and DNA to improve matching.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => window.location.href = "/me/dna"}>
                    Build Your DNA
                  </Button>
                </CardContent>
              </Card>
            ) : (
              matchingNeeds.map(({ need, match }) => (
                <NeedCard
                  key={need.id}
                  need={need}
                  matchInfo={match}
                  showActions="respond"
                  onRespond={setRespondNeed}
                />
              ))
            )}
          </TabsContent>

          {/* ===== YOUR POSTS TAB ===== */}
          <TabsContent value="yours" className="space-y-3 mt-3">
            <Button
              size="sm"
              className="w-full"
              onClick={() => setCreateOpen(true)}
              disabled={atLimit}
            >
              <Plus className="w-4 h-4 mr-1" /> New Post
            </Button>

            {atLimit && activeLimit > 0 && activeLimit !== -1 && (
              <p className="text-[10px] text-muted-foreground text-center">
                {openCount} of {effectiveLimit} active post{effectiveLimit === 1 ? "" : "s"} used
              </p>
            )}

            {loading ? (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <Skeleton key={i} className="h-28 rounded-lg" />
                ))}
              </div>
            ) : myPosts.length === 0 ? (
              <Card className="border-border/50">
                <CardContent className="p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    You haven't posted any needs or offers yet.
                  </p>
                </CardContent>
              </Card>
            ) : (
              myPosts.map(need => (
                <NeedCard
                  key={need.id}
                  need={need}
                  showActions="manage"
                  onComplete={handleComplete}
                  onDelete={handleDelete}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <CreateNeedDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={fetchAll}
      />
      <RespondToNeedDialog
        need={respondNeed}
        open={!!respondNeed}
        onOpenChange={open => { if (!open) setRespondNeed(null); }}
        onResponded={fetchAll}
      />
    </AppShell>
  );
}
