import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { calculateMatch } from "@/lib/matchUtils";

type Profile = Tables<"profiles">;

interface MatchedProfile extends Profile {
  matchScore: number;
  matchReasons: string[];
}

export type SortOption = "best-match" | "newest" | "recently-active";

const vibeLabels: Record<string, string> = {
  deep_focus: "🎯 Deep Focus",
  casual_social: "☕ Casual",
  balanced: "⚖️ Balanced",
};

export function useProfiles() {
  const { profile: currentProfile, user } = useAuth();
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [promptCounts, setPromptCounts] = useState<Record<string, number>>({});
  const [activeUserIds, setActiveUserIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [vibeFilter, setVibeFilter] = useState<string>("all");
  const [womenOnly, setWomenOnly] = useState(false);
  const [sort, setSort] = useState<SortOption>("best-match");
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("onboarding_completed", true);
      setAllProfiles(data ?? []);

      // Fetch prompt response counts per user
      const { data: respData } = await supabase
        .from("prompt_responses")
        .select("user_id");
      if (respData) {
        const counts: Record<string, number> = {};
        respData.forEach(r => { counts[r.user_id] = (counts[r.user_id] ?? 0) + 1; });
        setPromptCounts(counts);
      }

      // Fetch active users this week (prompt responders + RSVPers for upcoming events)
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const weekStr = oneWeekAgo.toISOString();

      const [recentResponders, recentRsvps] = await Promise.all([
        supabase.from("prompt_responses").select("user_id").gte("created_at", weekStr),
        supabase.from("event_rsvps").select("user_id").eq("status", "going").gte("created_at", weekStr),
      ]);

      const ids = new Set<string>();
      recentResponders.data?.forEach(r => ids.add(r.user_id));
      recentRsvps.data?.forEach(r => ids.add(r.user_id));
      setActiveUserIds(ids);

      setLoading(false);
    }
    fetch();
  }, []);

  const otherProfiles = useMemo(
    () => allProfiles.filter(p => p.id !== user?.id),
    [allProfiles, user?.id]
  );

  const matchedProfiles: MatchedProfile[] = useMemo(() => {
    if (!currentProfile) return otherProfiles.map(p => ({ ...p, matchScore: 0, matchReasons: [] }));
    return otherProfiles.map(p => {
      const { score, reasons } = calculateMatch(currentProfile, p);
      return { ...p, matchScore: score, matchReasons: reasons };
    });
  }, [otherProfiles, currentProfile]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return matchedProfiles;
    const q = search.toLowerCase();
    return matchedProfiles.filter(p => {
      const fields = [
        p.display_name, p.tagline, p.what_i_do,
        ...(p.looking_for ?? []), ...(p.can_offer ?? []), ...(p.interests ?? [])
      ];
      return fields.some(f => f?.toLowerCase().includes(q));
    });
  }, [matchedProfiles, search]);

  const bestMatches = useMemo(
    () => [...matchedProfiles].sort((a, b) => b.matchScore - a.matchScore).slice(0, 8),
    [matchedProfiles]
  );

  const newMembers = useMemo(() => {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    return otherProfiles
      .filter(p => p.created_at && new Date(p.created_at) >= twoWeeksAgo)
      .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime());
  }, [otherProfiles]);

  // In Your Area
  const inYourArea = useMemo(() => {
    if (!currentProfile?.neighborhood) return [];
    return matchedProfiles
      .filter(p => p.neighborhood === currentProfile.neighborhood)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 10);
  }, [matchedProfiles, currentProfile?.neighborhood]);

  // Can Help With What You Need
  const canHelpYou = useMemo(() => {
    const viewerLooking = currentProfile?.looking_for ?? [];
    if (viewerLooking.length === 0) return [];
    return matchedProfiles
      .map(p => {
        const offers = p.can_offer ?? [];
        const overlaps = viewerLooking.filter(t => offers.includes(t));
        return { ...p, helpOffers: overlaps };
      })
      .filter(r => r.helpOffers.length > 0)
      .sort((a, b) => b.helpOffers.length - a.helpOffers.length)
      .slice(0, 10);
  }, [matchedProfiles, currentProfile?.looking_for]);

  // Same Vibe
  const sameVibe = useMemo(() => {
    if (!currentProfile?.work_vibe) return [];
    return matchedProfiles
      .filter(p => p.work_vibe === currentProfile.work_vibe)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 10);
  }, [matchedProfiles, currentProfile?.work_vibe]);

  // Active This Week
  const activeThisWeek = useMemo(() => {
    return matchedProfiles
      .filter(p => activeUserIds.has(p.id))
      .sort((a, b) => new Date(b.last_active_at!).getTime() - new Date(a.last_active_at!).getTime())
      .slice(0, 10);
  }, [matchedProfiles, activeUserIds]);

  const directory = useMemo(() => {
    let list = search.trim() ? searchResults : matchedProfiles;

    if (vibeFilter !== "all") {
      list = list.filter(p => p.work_vibe === vibeFilter);
    }
    if (womenOnly) {
      list = list.filter(p => p.gender === "woman");
    }

    const sorted = [...list];
    if (sort === "best-match") sorted.sort((a, b) => b.matchScore - a.matchScore);
    else if (sort === "newest") sorted.sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime());
    else sorted.sort((a, b) => new Date(b.last_active_at!).getTime() - new Date(a.last_active_at!).getTime());

    return sorted;
  }, [searchResults, matchedProfiles, vibeFilter, womenOnly, sort, search]);

  const loadMore = useCallback(() => setVisibleCount(c => c + 20), []);

  return {
    loading,
    search, setSearch,
    vibeFilter, setVibeFilter,
    womenOnly, setWomenOnly,
    sort, setSort,
    bestMatches,
    newMembers,
    inYourArea,
    canHelpYou,
    sameVibe,
    activeThisWeek,
    directory,
    visibleCount, loadMore,
    totalCount: directory.length,
    currentProfile,
    promptCounts,
    vibeLabels,
  };
}

export { vibeLabels };
export type { MatchedProfile, Profile };
