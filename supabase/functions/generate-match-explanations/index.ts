import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { session_id } = await req.json();
    if (!session_id) throw new Error("session_id required");

    // Fetch groups and members for this session
    const { data: groups } = await supabase
      .from("groups")
      .select("id, group_number, group_members(user_id)")
      .eq("event_id", session_id);

    if (!groups || groups.length === 0) {
      return new Response(JSON.stringify({ message: "No groups found", generated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Collect all user IDs
    const allUserIds = new Set<string>();
    for (const g of groups) {
      for (const m of (g as any).group_members || []) {
        allUserIds.add(m.user_id);
      }
    }

    // Fetch profiles for all members
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, work_vibe, looking_for, can_offer, events_attended")
      .in("id", Array.from(allUserIds));

    const profileMap: Record<string, any> = {};
    for (const p of profiles || []) profileMap[p.id] = p;

    // Fetch company memberships for industry info
    const { data: companyMembers } = await supabase
      .from("company_members")
      .select("user_id, companies(industry_tags)")
      .in("user_id", Array.from(allUserIds));

    const industryMap: Record<string, string[]> = {};
    for (const cm of companyMembers || []) {
      const tags = (cm as any).companies?.industry_tags;
      if (tags?.length) industryMap[cm.user_id] = tags;
    }

    // Fetch existing connections between members
    const { data: connections } = await supabase
      .from("connections")
      .select("user_a, user_b, interaction_count")
      .or(
        Array.from(allUserIds).map(id => `user_a.eq.${id},user_b.eq.${id}`).join(",")
      );

    const connMap = new Map<string, number>();
    for (const c of connections || []) {
      const key = [c.user_a, c.user_b].sort().join(":");
      connMap.set(key, c.interaction_count || 0);
    }

    // Fetch templates and task config
    const { data: templates } = await supabase
      .from("match_templates")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: false });

    const { data: taskConfigs } = await supabase
      .from("ai_task_config")
      .select("*, ai_providers(*)")
      .in("task_type", ["match_explanation", "icebreaker"]);

    const explConfig = taskConfigs?.find((t: any) => t.task_type === "match_explanation");
    const ibConfig = taskConfigs?.find((t: any) => t.task_type === "icebreaker");

    let generated = 0;

    for (const group of groups) {
      const members = ((group as any).group_members || []).map((m: any) => m.user_id);

      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const userA = members[i];
          const userB = members[j];

          // Process both directions
          for (const [userId, matchedId] of [[userA, userB], [userB, userA]]) {
            // Check cache
            const { data: existing } = await supabase
              .from("ai_match_explanations")
              .select("id")
              .eq("user_id", userId)
              .eq("matched_user_id", matchedId)
              .eq("session_id", session_id)
              .maybeSingle();

            if (existing) continue;

            const userProfile = profileMap[userId];
            const matchProfile = profileMap[matchedId];
            if (!userProfile || !matchProfile) continue;

            const userIndustries = industryMap[userId] || [];
            const matchIndustries = industryMap[matchedId] || [];
            const connKey = [userId, matchedId].sort().join(":");
            const interactions = connMap.get(connKey) || 0;

            // Try template matching
            const result = tryTemplateMatch(
              userProfile, matchProfile, userIndustries, matchIndustries,
              interactions, templates || []
            );

            if (result) {
              await supabase.from("ai_match_explanations").insert({
                user_id: userId,
                matched_user_id: matchedId,
                session_id,
                explanation: result.explanation,
                icebreaker: result.icebreaker,
                compatibility_score: result.score,
              });
              await supabase.from("ai_usage_log").insert({
                task_type: "match_explanation",
                source: "template",
              });
              generated++;
              continue;
            }

            // Try AI generation
            if (explConfig?.is_active && explConfig?.ai_providers?.is_active) {
              const aiResult = await tryAIGeneration(
                userProfile, matchProfile, userIndustries, matchIndustries,
                explConfig, ibConfig
              );
              if (aiResult) {
                await supabase.from("ai_match_explanations").insert({
                  user_id: userId,
                  matched_user_id: matchedId,
                  session_id,
                  explanation: aiResult.explanation,
                  icebreaker: aiResult.icebreaker,
                  compatibility_score: aiResult.score,
                });
                await supabase.from("ai_usage_log").insert({
                  task_type: "match_explanation",
                  source: "ai",
                  provider_id: explConfig.provider_id,
                  model: explConfig.model,
                  input_tokens: aiResult.inputTokens,
                  output_tokens: aiResult.outputTokens,
                });
                generated++;
                continue;
              }
            }

            // Generic fallback
            if (explConfig?.fallback_to_template !== false) {
              await supabase.from("ai_match_explanations").insert({
                user_id: userId,
                matched_user_id: matchedId,
                session_id,
                explanation: "You've been matched based on complementary work styles — great things happen when the right people share a table.",
                icebreaker: "Share what you're working on today and find something in common",
                compatibility_score: 50,
              });
              await supabase.from("ai_usage_log").insert({
                task_type: "match_explanation",
                source: "template",
              });
              generated++;
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, generated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-match-explanations error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Template Matching ───────────────────────────────────
function tryTemplateMatch(
  user: any, match: any,
  userIndustries: string[], matchIndustries: string[],
  interactions: number, templates: any[]
): { explanation: string; icebreaker: string | null; score: number } | null {
  // Determine match type
  let bestTemplate: any = null;
  let replacements: Record<string, string> = {
    user_name: user.display_name || "You",
    match_name: match.display_name || "Your match",
  };

  for (const t of templates) {
    switch (t.match_type) {
      case "repeat_match":
        if (interactions >= 2) { bestTemplate = t; }
        break;
      case "new_member":
        if ((match.events_attended || 0) <= 1) {
          bestTemplate = t;
        }
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
          const overlap = user.looking_for.filter((l: string) => match.can_offer.includes(l));
          if (overlap.length > 0) {
            replacements.user_need = overlap[0];
            replacements.match_skill = overlap[0];
            bestTemplate = t;
          }
        }
        break;
      case "same_industry":
        if (userIndustries.length && matchIndustries.length) {
          const shared = userIndustries.filter(i => matchIndustries.includes(i));
          if (shared.length > 0) {
            replacements.industry = shared[0];
            bestTemplate = t;
          }
        }
        break;
      case "same_goals":
        if (user.looking_for?.length && match.looking_for?.length) {
          const shared = user.looking_for.filter((g: string) => match.looking_for.includes(g));
          if (shared.length > 0) {
            replacements.goal = shared[0];
            bestTemplate = t;
          }
        }
        break;
      case "cross_industry":
        if (userIndustries.length && matchIndustries.length) {
          const shared = userIndustries.filter(i => matchIndustries.includes(i));
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
    // Use first (highest priority) match since templates are sorted by priority desc
    if (bestTemplate) break;
  }

  if (!bestTemplate) return null;

  const explanation = fillTemplate(bestTemplate.template, replacements);
  const icebreaker = bestTemplate.icebreaker_template
    ? fillTemplate(bestTemplate.icebreaker_template, replacements)
    : null;

  return { explanation, icebreaker, score: 65 };
}

function fillTemplate(template: string, replacements: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => replacements[key] || key);
}

// ─── AI Generation ───────────────────────────────────
async function tryAIGeneration(
  user: any, match: any,
  userIndustries: string[], matchIndustries: string[],
  explConfig: any, ibConfig: any
): Promise<{ explanation: string; icebreaker: string | null; score: number; inputTokens: number; outputTokens: number } | null> {
  try {
    const provider = explConfig.ai_providers;
    const apiKey = (Deno.env.get(provider.api_key_env) || '').trim();
    if (!apiKey) return null;

    const userDesc = `${user.display_name || "User"}: work vibe=${user.work_vibe || "unknown"}, looking for=${(user.looking_for || []).join(", ")}, can offer=${(user.can_offer || []).join(", ")}, industries=${userIndustries.join(", ") || "unknown"}, sessions attended=${user.events_attended || 0}`;
    const matchDesc = `${match.display_name || "Match"}: work vibe=${match.work_vibe || "unknown"}, looking for=${(match.looking_for || []).join(", ")}, can offer=${(match.can_offer || []).join(", ")}, industries=${matchIndustries.join(", ") || "unknown"}, sessions attended=${match.events_attended || 0}`;

    const prompt = `Person A: ${userDesc}\nPerson B: ${matchDesc}\n\nExplain why they're a good match and suggest a conversation starter.`;

    let explanation = "";
    let icebreaker = "";
    let inputTokens = 0;
    let outputTokens = 0;

    if (provider.id === "anthropic") {
      const resp = await fetch(`${provider.base_url}/messages`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "content-type": "application/json",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: explConfig.model,
          max_tokens: explConfig.max_tokens,
          temperature: Number(explConfig.temperature),
          system: explConfig.system_prompt,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      const text = data.content?.[0]?.text || "";
      explanation = text;
      inputTokens = data.usage?.input_tokens || 0;
      outputTokens = data.usage?.output_tokens || 0;
    } else {
      // OpenAI-compatible (openai, groq, etc.)
      const resp = await fetch(`${provider.base_url}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: explConfig.model,
          temperature: Number(explConfig.temperature),
          max_tokens: explConfig.max_tokens,
          messages: [
            { role: "system", content: explConfig.system_prompt },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      explanation = data.choices?.[0]?.message?.content || "";
      inputTokens = data.usage?.prompt_tokens || 0;
      outputTokens = data.usage?.completion_tokens || 0;
    }

    if (!explanation) return null;

    // Try to extract icebreaker from separate call if config exists
    if (ibConfig?.is_active && ibConfig?.ai_providers?.is_active) {
      try {
        const ibProvider = ibConfig.ai_providers;
        const ibKey = (Deno.env.get(ibProvider.api_key_env) || '').trim();
        if (ibKey) {
          const ibPrompt = `Person A: ${userDesc}\nPerson B: ${matchDesc}`;
          if (ibProvider.id === "anthropic") {
            const r = await fetch(`${ibProvider.base_url}/messages`, {
              method: "POST",
              headers: { "x-api-key": ibKey, "content-type": "application/json", "anthropic-version": "2023-06-01" },
              body: JSON.stringify({ model: ibConfig.model, max_tokens: ibConfig.max_tokens, temperature: Number(ibConfig.temperature), system: ibConfig.system_prompt, messages: [{ role: "user", content: ibPrompt }] }),
            });
            if (r.ok) { const d = await r.json(); icebreaker = d.content?.[0]?.text || ""; }
          } else {
            const r = await fetch(`${ibProvider.base_url}/chat/completions`, {
              method: "POST",
              headers: { Authorization: `Bearer ${ibKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ model: ibConfig.model, temperature: Number(ibConfig.temperature), max_tokens: ibConfig.max_tokens, messages: [{ role: "system", content: ibConfig.system_prompt }, { role: "user", content: ibPrompt }] }),
            });
            if (r.ok) { const d = await r.json(); icebreaker = d.choices?.[0]?.message?.content || ""; }
          }
        }
      } catch { /* icebreaker generation is optional */ }
    }

    return { explanation, icebreaker: icebreaker || null, score: 75, inputTokens, outputTokens };
  } catch (e) {
    console.error("AI generation failed:", e);
    return null;
  }
}
