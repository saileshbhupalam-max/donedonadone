/**
 * @module icebreakers
 * @description Icebreaker round selection engine based on group experience level.
 * Selects questions from 4 categories (quick_fire, pair_share, group_challenge, intention_set),
 * preferring appropriate depth levels and least-used questions for variety.
 *
 * Key exports:
 * - selectIcebreakerRounds() — Fetches active questions, selects rounds based on "new"/"mixed"/"experienced" group level
 * - IcebreakerRound / IcebreakerQuestion — TypeScript interfaces for round/question data
 *
 * Dependencies: Supabase client (queries and updates icebreaker_questions table)
 * Side effects: Increments times_used counter on selected questions
 * Related: IcebreakerEngine.tsx (renders rounds with timers), Admin IcebreakersTab.tsx (question management)
 */
import { supabase } from "@/integrations/supabase/client";

export interface IcebreakerQuestion {
  id: string;
  question: string;
  category: string;
  depth: string;
  emoji: string;
  active: boolean;
  times_used: number;
}

export interface IcebreakerRound {
  type: "quick_fire" | "pair_share" | "group_challenge" | "intention_set";
  label: string;
  instruction: string;
  timerSeconds: number;
  questions: IcebreakerQuestion[];
}

const ROUND_CONFIG: Record<string, { label: string; instruction: string; timerSeconds: number }> = {
  quick_fire: { label: "Quick Fire", instruction: "⏱️ 10 seconds each! Go around the table.", timerSeconds: 60 },
  pair_share: { label: "Pair & Share", instruction: "Pair up! One question, 2 minutes each.", timerSeconds: 240 },
  group_challenge: { label: "Group Challenge", instruction: "Everyone together! You have 3 minutes.", timerSeconds: 180 },
  intention_set: { label: "Set Your Intention", instruction: "Write your intention for this session.", timerSeconds: 60 },
};

export async function selectIcebreakerRounds(groupExperience: "new" | "mixed" | "experienced"): Promise<IcebreakerRound[]> {
  const { data: allQuestions } = await supabase
    .from("icebreaker_questions")
    .select("*")
    .eq("active", true)
    .order("times_used", { ascending: true });

  if (!allQuestions || allQuestions.length === 0) return [];

  const byCategory: Record<string, IcebreakerQuestion[]> = {};
  allQuestions.forEach((q: any) => {
    if (!byCategory[q.category]) byCategory[q.category] = [];
    byCategory[q.category].push(q);
  });

  // Depth preference based on group experience
  const preferredDepths = groupExperience === "new" ? ["light", "medium"]
    : groupExperience === "experienced" ? ["medium", "deep"] : ["light", "medium", "deep"];

  const pick = (cat: string, count: number): IcebreakerQuestion[] => {
    const pool = byCategory[cat] || [];
    // Prefer matching depth, sorted by times_used
    const preferred = pool.filter(q => preferredDepths.includes(q.depth));
    const fallback = pool.filter(q => !preferredDepths.includes(q.depth));
    const sorted = [...preferred, ...fallback];
    // Shuffle within same times_used for variety
    const shuffled = sorted.sort((a, b) => {
      if (a.times_used !== b.times_used) return a.times_used - b.times_used;
      return Math.random() - 0.5;
    });
    return shuffled.slice(0, count);
  };

  const quickFire = pick("quick_fire", 2);
  const pairShare = pick("pair_share", 1);
  const groupChallenge = pick("group_challenge", 1);
  const intentionSet = pick("intention_set", 1);

  // Increment times_used for selected questions
  const selectedIds = [...quickFire, ...pairShare, ...groupChallenge, ...intentionSet].map(q => q.id);
  for (const id of selectedIds) {
    await supabase.from("icebreaker_questions").update({ times_used: (allQuestions.find((q: any) => q.id === id)?.times_used ?? 0) + 1 }).eq("id", id);
  }

  const rounds: IcebreakerRound[] = [];
  if (quickFire.length > 0) {
    const cfg = ROUND_CONFIG.quick_fire;
    rounds.push({ type: "quick_fire", ...cfg, questions: quickFire });
  }
  if (pairShare.length > 0) {
    const cfg = ROUND_CONFIG.pair_share;
    rounds.push({ type: "pair_share", ...cfg, questions: pairShare });
  }
  if (groupChallenge.length > 0) {
    const cfg = ROUND_CONFIG.group_challenge;
    rounds.push({ type: "group_challenge", ...cfg, questions: groupChallenge });
  }
  if (intentionSet.length > 0) {
    const cfg = ROUND_CONFIG.intention_set;
    rounds.push({ type: "intention_set", ...cfg, questions: intentionSet });
  }

  return rounds;
}
