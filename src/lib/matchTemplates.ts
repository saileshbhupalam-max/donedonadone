/**
 * Pure functions extracted from the generate-match-explanations Edge Function
 * for testability. These mirror the logic in supabase/functions/generate-match-explanations/index.ts
 */

export interface MatchProfile {
  display_name: string | null;
  work_vibe: string | null;
  looking_for: string[] | null;
  can_offer: string[] | null;
  events_attended: number | null;
}

export interface MatchTemplate {
  match_type: string;
  template: string;
  icebreaker_template: string | null;
  priority: number;
  is_active: boolean;
}

export interface MatchResult {
  explanation: string;
  icebreaker: string | null;
  score: number;
}

export function fillTemplate(template: string, replacements: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => replacements[key] || key);
}

export function tryTemplateMatch(
  user: MatchProfile,
  match: MatchProfile,
  userIndustries: string[],
  matchIndustries: string[],
  interactions: number,
  templates: MatchTemplate[]
): MatchResult | null {
  let bestTemplate: MatchTemplate | null = null;
  const replacements: Record<string, string> = {
    user_name: user.display_name || "You",
    match_name: match.display_name || "Your match",
  };

  for (const t of templates) {
    switch (t.match_type) {
      case "repeat_match":
        if (interactions >= 2) bestTemplate = t;
        break;
      case "new_member":
        if ((match.events_attended || 0) <= 1) bestTemplate = t;
        break;
      case "same_vibe":
        if (user.work_vibe && user.work_vibe === match.work_vibe) {
          const labels: Record<string, string> = { deep_focus: "deep focus", casual_social: "social", balanced: "balanced" };
          replacements.vibe = labels[user.work_vibe] || user.work_vibe;
          bestTemplate = t;
        }
        break;
      case "complementary_skills":
        if (user.looking_for?.length && match.can_offer?.length) {
          const overlap = user.looking_for.filter((l) => match.can_offer!.includes(l));
          if (overlap.length > 0) {
            replacements.user_need = overlap[0];
            replacements.match_skill = overlap[0];
            bestTemplate = t;
          }
        }
        break;
      case "same_industry":
        if (userIndustries.length && matchIndustries.length) {
          const shared = userIndustries.filter((i) => matchIndustries.includes(i));
          if (shared.length > 0) {
            replacements.industry = shared[0];
            bestTemplate = t;
          }
        }
        break;
      case "same_goals":
        if (user.looking_for?.length && match.looking_for?.length) {
          const shared = user.looking_for.filter((g) => match.looking_for!.includes(g));
          if (shared.length > 0) {
            replacements.goal = shared[0];
            bestTemplate = t;
          }
        }
        break;
      case "cross_industry":
        if (userIndustries.length && matchIndustries.length) {
          const shared = userIndustries.filter((i) => matchIndustries.includes(i));
          if (shared.length === 0) bestTemplate = t;
        }
        break;
      case "skill_swap":
        if (user.can_offer?.length && match.can_offer?.length) {
          replacements.user_skill = user.can_offer[0];
          replacements.match_skill = match.can_offer[0];
          bestTemplate = t;
        }
        break;
    }
    if (bestTemplate) break;
  }

  if (!bestTemplate) return null;

  const explanation = fillTemplate(bestTemplate.template, replacements);
  const icebreaker = bestTemplate.icebreaker_template
    ? fillTemplate(bestTemplate.icebreaker_template, replacements)
    : null;

  return { explanation, icebreaker, score: 65 };
}
