import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { calculateMatch } from "@/lib/matchUtils";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { ERROR_STATES, CONFIRMATIONS } from "@/lib/personality";
import { trackAnalyticsEvent } from "@/lib/growth";

type Profile = Tables<"profiles">;

export interface Prompt {
  id: string;
  question: string;
  category: string | null;
  emoji: string | null;
  is_active: boolean | null;
  sort_order: number | null;
  response_count: number | null;
  created_at: string | null;
}

export interface PromptResponse {
  id: string;
  user_id: string;
  prompt_id: string;
  answer: string | null;
  fire_count: number | null;
  created_at: string | null;
  profile?: Profile;
  hasReacted?: boolean;
}

export type AnswerSort = "recent" | "fire" | "match";

export function usePrompts() {
  const { user, profile: myProfile } = useAuth();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("prompts").select("*").order("sort_order").then(({ data, error }) => {
      if (error) console.error("[PromptsLoad]", error);
      setPrompts((data as Prompt[]) ?? []);
      setLoading(false);
    });
  }, []);

  const activePrompt = useMemo(() => prompts.find(p => p.is_active), [prompts]);
  const previousPrompts = useMemo(() => prompts.filter(p => !p.is_active), [prompts]);

  return { prompts, activePrompt, previousPrompts, loading, setPrompts, user, myProfile };
}

export function usePromptAnswers(promptId: string | undefined) {
  const { user, profile: myProfile } = useAuth();
  const [responses, setResponses] = useState<PromptResponse[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<AnswerSort>("recent");
  const [visibleCount, setVisibleCount] = useState(15);
  const [myReactions, setMyReactions] = useState<Set<string>>(new Set());

  const fetchResponses = useCallback(async () => {
    if (!promptId) return;
    setLoading(true);

    const { data: resData, error } = await supabase
      .from("prompt_responses")
      .select("*")
      .eq("prompt_id", promptId)
      .order("created_at", { ascending: false });

    if (error) console.error("[PromptResponsesLoad]", error);

    const res = (resData ?? []) as PromptResponse[];
    setResponses(res);

    // Fetch profiles for all responders
    const userIds = [...new Set(res.map(r => r.user_id))];
    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .in("id", userIds);
      const map: Record<string, Profile> = {};
      (profileData ?? []).forEach(p => { map[p.id] = p; });
      setProfiles(map);
    }

    // Fetch my reactions
    if (user) {
      const responseIds = res.map(r => r.id);
      if (responseIds.length > 0) {
        const { data: reactionData } = await supabase
          .from("prompt_reactions")
          .select("response_id")
          .eq("user_id", user.id)
          .in("response_id", responseIds);
        setMyReactions(new Set((reactionData ?? []).map(r => r.response_id)));
      }
    }

    setLoading(false);
  }, [promptId, user]);

  useEffect(() => { fetchResponses(); }, [fetchResponses]);

  const myResponse = useMemo(() => 
    responses.find(r => r.user_id === user?.id), [responses, user?.id]);

  const sortedResponses = useMemo(() => {
    const others = responses.filter(r => r.user_id !== user?.id);
    if (sort === "recent") return others;
    if (sort === "fire") return [...others].sort((a, b) => (b.fire_count ?? 0) - (a.fire_count ?? 0));
    // match sort
    if (!myProfile) return others;
    return [...others].sort((a, b) => {
      const pa = profiles[a.user_id];
      const pb = profiles[b.user_id];
      const sa = pa ? calculateMatch(myProfile, pa).score : 0;
      const sb = pb ? calculateMatch(myProfile, pb).score : 0;
      return sb - sa;
    });
  }, [responses, sort, user?.id, myProfile, profiles]);

  const submitAnswer = useCallback(async (answer: string) => {
    if (!user || !promptId) return;
    try {
      if (myResponse) {
        // Update
        setResponses(prev => prev.map(r => r.id === myResponse.id ? { ...r, answer } : r));
        const { error } = await supabase.from("prompt_responses").update({ answer }).eq("id", myResponse.id);
        if (error) throw error;
      } else {
        // Insert
        const temp: PromptResponse = {
          id: crypto.randomUUID(), user_id: user.id, prompt_id: promptId,
          answer, fire_count: 0, created_at: new Date().toISOString(),
        };
        setResponses(prev => [temp, ...prev]);
        const { data, error } = await supabase.from("prompt_responses")
          .insert({ user_id: user.id, prompt_id: promptId, answer })
          .select().single();
        if (error) throw error;
        if (data) {
          setResponses(prev => prev.map(r => r.id === temp.id ? (data as unknown as PromptResponse) : r));
        }
        trackAnalyticsEvent('prompt_answer', user.id).catch(() => {});
        toast.success(CONFIRMATIONS.promptAnswered);
      }
    } catch (error) {
      console.error("[PromptSubmit]", error);
      toast.error(ERROR_STATES.generic);
      // Revert on error
      fetchResponses();
    }
  }, [user, promptId, myResponse, fetchResponses]);

  const toggleReaction = useCallback(async (responseId: string) => {
    if (!user) return;
    const hasReacted = myReactions.has(responseId);
    // Optimistic
    setMyReactions(prev => {
      const next = new Set(prev);
      if (hasReacted) next.delete(responseId); else next.add(responseId);
      return next;
    });
    setResponses(prev => prev.map(r =>
      r.id === responseId ? { ...r, fire_count: (r.fire_count ?? 0) + (hasReacted ? -1 : 1) } : r
    ));

    try {
      if (hasReacted) {
        await supabase.from("prompt_reactions").delete().eq("response_id", responseId).eq("user_id", user.id);
        await supabase.from("prompt_responses").update({ fire_count: Math.max(0, (responses.find(r => r.id === responseId)?.fire_count ?? 1) - 1) }).eq("id", responseId);
      } else {
        await supabase.from("prompt_reactions").insert({ response_id: responseId, user_id: user.id });
        await supabase.from("prompt_responses").update({ fire_count: (responses.find(r => r.id === responseId)?.fire_count ?? 0) + 1 }).eq("id", responseId);
      }
    } catch (error) {
      console.error("[ToggleReaction]", error);
      // Revert
      setMyReactions(prev => {
        const next = new Set(prev);
        if (hasReacted) next.add(responseId); else next.delete(responseId);
        return next;
      });
      setResponses(prev => prev.map(r =>
        r.id === responseId ? { ...r, fire_count: (r.fire_count ?? 0) + (hasReacted ? 1 : -1) } : r
      ));
    }
  }, [user, myReactions, responses]);

  return {
    responses: sortedResponses, myResponse, profiles, loading,
    sort, setSort, visibleCount, loadMore: () => setVisibleCount(c => c + 15),
    submitAnswer, toggleReaction, myReactions, totalCount: sortedResponses.length,
  };
}
