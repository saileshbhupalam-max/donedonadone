/**
 * @module ai-community-manager Edge Function
 * @description Daily AI-driven community management automation. Runs via cron
 * (or manual POST) and performs three distinct tasks:
 *
 *   1. **Churn prediction** - Identifies members who were active but have gone
 *      silent (>14 days, >=2 past events). Generates personalized re-engagement
 *      messages via Claude and inserts notifications directly (service_role).
 *
 *   2. **Auto-welcome** - Finds profiles created in the last 24 hours that
 *      haven't been welcomed yet. Generates a personalized welcome message
 *      using their work_vibe, looking_for, and can_offer fields.
 *
 *   3. **Community prompts** - Runs only on Mondays. Aggregates recent session
 *      topics and popular interests, then asks Claude for 3 discussion prompts.
 *      Inserts them into the `prompts` table.
 *
 * **Template graduation:** After enough AI-generated messages accumulate per
 * work_vibe category, the system skips Claude entirely and reuses a cached
 * template with name substitution. This progressively reduces AI cost to zero
 * for common vibes while maintaining personalization quality.
 *
 * @key-exports None (Edge Function entry point)
 * @dependencies Anthropic Messages API (claude-haiku-4-5-20251001)
 * @tables profiles, notifications, notification_log, prompts, ai_usage_log,
 *         event_rsvps, events, ai_cache
 *
 * @accepts POST { action?: "churn" | "welcome" | "prompts" | "all" }
 *          Defaults to "all" if action is omitted.
 * @returns { churn_nudges: number, welcomes: number, prompts: number }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---- Types -----------------------------------------------------------------

interface AtRiskProfile {
  id: string;
  display_name: string | null;
  work_vibe: string | null;
  looking_for: string[] | null;
  can_offer: string[] | null;
  interests: string[] | null;
  neighborhood: string | null;
  events_attended: number | null;
  focus_hours: number | null;
  last_session_at: string | null;
}

interface NewProfile {
  id: string;
  display_name: string | null;
  work_vibe: string | null;
  looking_for: string[] | null;
  can_offer: string[] | null;
  interests: string[] | null;
  neighborhood: string | null;
  created_at: string;
}

interface ClaudeResponse {
  content?: Array<{ text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

interface TaskCounts {
  churn_nudges: number;
  welcomes: number;
  prompts: number;
}

interface CachedTemplate {
  cache_value: {
    text: string;
    display_name: string;
  };
}

// ---- Constants -------------------------------------------------------------

/**
 * WHY 5: below this threshold, templates lack enough variety and reuse would
 * feel repetitive. At 5+, random selection gives reasonable diversity across
 * work vibes. This also means every vibe pays the AI cost for exactly 5
 * messages before graduating to zero-cost templates.
 */
const TEMPLATE_GRADUATION_THRESHOLD = 5;

/**
 * WHY 90 days: templates stay relevant for roughly a quarter. After 90 days
 * they expire, forcing fresh AI generation to keep messaging current with
 * platform changes and seasonal context.
 */
const TEMPLATE_TTL_DAYS = 90;

// ---- Claude helper ---------------------------------------------------------

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

/**
 * Sends a single prompt to Claude and returns the text response plus token
 * counts. Returns null on any failure so callers can skip gracefully.
 *
 * WHY we cap max_tokens at 300: these are short notification-length messages,
 * not essays. Keeps cost low on a daily cron that may process hundreds of users.
 */
async function callClaude(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 300,
): Promise<{ text: string; inputTokens: number; outputTokens: number } | null> {
  try {
    const resp = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        temperature: 0.7,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!resp.ok) {
      console.error(
        `[AICommunityManager] Claude API error: ${resp.status} ${resp.statusText}`,
      );
      return null;
    }

    const data: ClaudeResponse = await resp.json();
    const text = data.content?.[0]?.text || "";
    if (!text) return null;

    return {
      text,
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
    };
  } catch (err) {
    console.error("[AICommunityManager] Claude call failed:", err);
    return null;
  }
}

/**
 * Logs an AI usage row for cost tracking and audit.
 * The `source` field distinguishes live AI calls from template cache hits,
 * so dashboards can track graduation effectiveness over time.
 */
async function logAiUsage(
  supabase: ReturnType<typeof createClient>,
  taskType: string,
  inputTokens: number,
  outputTokens: number,
  source: "ai" | "template_cache" = "ai",
): Promise<void> {
  await supabase.from("ai_usage_log").insert({
    task_type: taskType,
    source,
    provider_id: source === "ai" ? "anthropic" : "template_cache",
    model: source === "ai" ? MODEL : "cached",
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  });
}

// ---- Template graduation helpers -------------------------------------------

/**
 * Attempts to serve a message from the template cache instead of calling Claude.
 *
 * WHY this exists: every AI call costs tokens. Once we have enough good examples
 * for a given work_vibe, we can reuse them with simple name substitution. The
 * messages were already AI-crafted and personalized by vibe, so swapping the name
 * preserves quality at zero marginal cost.
 *
 * Returns the substituted message text if enough templates exist, or null if the
 * caller should fall back to a live AI call.
 */
async function tryTemplateGraduation(
  supabase: ReturnType<typeof createClient>,
  cacheType: string,
  vibeKey: string,
  newDisplayName: string,
): Promise<string | null> {
  const nowIso = new Date().toISOString();

  // Count how many unexpired templates exist for this type + vibe
  const { count, error: countErr } = await supabase
    .from("ai_cache")
    .select("id", { count: "exact", head: true })
    .eq("cache_type", cacheType)
    .like("cache_key", `${vibeKey}:%`)
    .gt("expires_at", nowIso);

  if (countErr || !count || count < TEMPLATE_GRADUATION_THRESHOLD) {
    return null;
  }

  // Enough templates accumulated -- pick a random one from up to 10 candidates
  // WHY limit(10): keeps the query light while still giving variety
  const { data: templates, error: fetchErr } = await supabase
    .from("ai_cache")
    .select("cache_value")
    .eq("cache_type", cacheType)
    .like("cache_key", `${vibeKey}:%`)
    .gt("expires_at", nowIso)
    .limit(10);

  if (fetchErr || !templates || templates.length === 0) {
    return null;
  }

  const picked = templates[
    Math.floor(Math.random() * templates.length)
  ] as CachedTemplate;

  const templateText: string = picked.cache_value?.text;
  if (!templateText) return null;

  // Replace the original member's name with the new member's name
  // WHY global replace: the name may appear multiple times (greeting + sign-off)
  const originalName: string = picked.cache_value?.display_name || "Member";
  const safeName = newDisplayName || "there";
  const newText = templateText.replace(new RegExp(originalName, "g"), safeName);

  console.log(
    `[AICommunityManager] Template graduation: served ${cacheType} for vibe "${vibeKey}" from cache (${count} templates available)`,
  );

  return newText;
}

/**
 * Stores a freshly AI-generated message as a reusable template in ai_cache.
 *
 * WHY we append Date.now() to cache_key: the ai_cache table has a UNIQUE
 * constraint on (cache_type, cache_key). We need multiple templates per vibe,
 * so the timestamp suffix makes each key unique while preserving the vibe
 * prefix for LIKE queries.
 *
 * Failures are silently caught -- template storage is an optimization, not
 * a critical path. If the insert fails (race condition, constraint violation),
 * the system still works fine with live AI calls.
 */
async function storeTemplate(
  supabase: ReturnType<typeof createClient>,
  cacheType: string,
  vibeKey: string,
  text: string,
  displayName: string,
): Promise<void> {
  const expiresAt = new Date(
    Date.now() + TEMPLATE_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  try {
    await supabase.from("ai_cache").insert({
      cache_type: cacheType,
      cache_key: `${vibeKey}:${Date.now()}`,
      cache_value: { text, display_name: displayName },
      hit_count: 0,
      expires_at: expiresAt,
    });
  } catch {
    // Silently ignore insert failures -- this is a best-effort optimization
  }
}

// ---- Task 1: Churn prediction ----------------------------------------------

/**
 * Finds members who:
 *   - Attended >= 2 events (genuinely active, not just signups)
 *   - Last session > 14 days ago
 *   - Have NOT received a churn_nudge in the last 7 days
 *
 * WHY >= 2 events: single-event users may have just tried the platform once.
 * We only want to re-engage people who demonstrated repeat behavior and then
 * dropped off -- those are the highest-value saves.
 */
async function runChurnPrediction(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
): Promise<number> {
  const now = new Date();
  const fourteenDaysAgo = new Date(
    now.getTime() - 14 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const sevenDaysAgo = new Date(
    now.getTime() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Fetch profiles that have gone quiet
  const { data: atRiskProfiles, error: profileErr } = await supabase
    .from("profiles")
    .select(
      "id, display_name, work_vibe, looking_for, can_offer, interests, neighborhood, events_attended, focus_hours, last_session_at",
    )
    .gte("events_attended", 2)
    .lt("last_session_at", fourteenDaysAgo)
    .not("last_session_at", "is", null);

  if (profileErr) {
    console.error("[AICommunityManager] Churn profile query error:", profileErr);
    return 0;
  }

  if (!atRiskProfiles || atRiskProfiles.length === 0) {
    console.log("[AICommunityManager] No at-risk profiles found");
    return 0;
  }

  // Get users already nudged in last 7 days so we don't spam them
  const { data: recentNudges } = await supabase
    .from("notification_log")
    .select("user_id")
    .eq("category", "churn_nudge")
    .gte("created_at", sevenDaysAgo);

  const recentlyNudgedIds = new Set(
    (recentNudges || []).map((n: { user_id: string }) => n.user_id),
  );

  const candidates = (atRiskProfiles as AtRiskProfile[]).filter(
    (p) => !recentlyNudgedIds.has(p.id),
  );

  console.log(
    `[AICommunityManager] Churn: ${atRiskProfiles.length} at-risk, ${candidates.length} not recently nudged`,
  );

  let nudgesSent = 0;

  for (const profile of candidates) {
    const daysSinceSession = profile.last_session_at
      ? Math.floor(
          (now.getTime() - new Date(profile.last_session_at).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

    const vibeKey = profile.work_vibe || "default";
    const memberName = profile.display_name || "Member";

    // Try template graduation before spending tokens on a live AI call
    const cachedText = await tryTemplateGraduation(
      supabase,
      "churn_template",
      vibeKey,
      memberName,
    );

    let messageText: string;

    if (cachedText) {
      messageText = cachedText;

      // Log as template_cache hit -- zero AI cost
      await logAiUsage(supabase, "churn_nudge", 0, 0, "template_cache");
    } else {
      const systemPrompt = `You are a friendly community manager for DanaDone, a social coworking platform in Bangalore where solo workers meet up at cafes to work together. Write a short, warm re-engagement message (2-3 sentences max) to bring a lapsed member back. Be specific to their interests when possible. Do not use exclamation marks excessively. Do not include a subject line — just the message body. Do not use placeholder brackets.`;

      const userPrompt = `Member: ${memberName}
Work vibe: ${profile.work_vibe || "not set"}
Interests: ${(profile.interests || []).join(", ") || "not listed"}
Looking for: ${(profile.looking_for || []).join(", ") || "not listed"}
Neighborhood: ${profile.neighborhood || "not set"}
Sessions attended: ${profile.events_attended || 0}
Focus hours: ${profile.focus_hours || 0}
Days since last session: ${daysSinceSession}

Write a personalized re-engagement message for this member.`;

      const result = await callClaude(apiKey, systemPrompt, userPrompt);
      if (!result) continue;

      messageText = result.text;

      // Store this fresh AI output as a template for future reuse
      await storeTemplate(
        supabase,
        "churn_template",
        vibeKey,
        result.text,
        memberName,
      );

      await logAiUsage(
        supabase,
        "churn_nudge",
        result.inputTokens,
        result.outputTokens,
      );
    }

    const title = "We miss you at DanaDone";

    // Insert notification directly -- we have service_role access
    await supabase.from("notifications").insert({
      user_id: profile.id,
      type: "churn_nudge",
      title,
      body: messageText,
      link: "/home",
    });

    // Log to notification_log for dedup tracking
    await supabase.from("notification_log").insert({
      user_id: profile.id,
      channel: "in_app",
      category: "churn_nudge",
      title,
      body: messageText,
      status: "sent",
      metadata: {
        days_since_session: daysSinceSession,
        events_attended: profile.events_attended,
        ai_generated: !cachedText,
        template_cached: !!cachedText,
      },
    });

    nudgesSent++;
  }

  console.log(`[AICommunityManager] Churn: sent ${nudgesSent} nudges`);
  return nudgesSent;
}

// ---- Task 2: Auto-welcome --------------------------------------------------

/**
 * Welcomes members who signed up in the last 24 hours and haven't been
 * welcomed yet.
 *
 * WHY 24 hours and not "today": the cron may run at any hour. A user who
 * signed up at 23:00 would be missed if we only checked "today". The 24h
 * window plus the notification_log dedup ensures exactly-once delivery.
 */
async function runAutoWelcome(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
): Promise<number> {
  const twentyFourHoursAgo = new Date(
    Date.now() - 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: newProfiles, error: profileErr } = await supabase
    .from("profiles")
    .select(
      "id, display_name, work_vibe, looking_for, can_offer, interests, neighborhood, created_at",
    )
    .gte("created_at", twentyFourHoursAgo);

  if (profileErr) {
    console.error(
      "[AICommunityManager] Welcome profile query error:",
      profileErr,
    );
    return 0;
  }

  if (!newProfiles || newProfiles.length === 0) {
    console.log("[AICommunityManager] No new profiles to welcome");
    return 0;
  }

  // Check who has already been welcomed
  const { data: alreadyWelcomed } = await supabase
    .from("notification_log")
    .select("user_id")
    .eq("category", "welcome")
    .in(
      "user_id",
      newProfiles.map((p: { id: string }) => p.id),
    );

  const welcomedIds = new Set(
    (alreadyWelcomed || []).map((w: { user_id: string }) => w.user_id),
  );

  const candidates = (newProfiles as NewProfile[]).filter(
    (p) => !welcomedIds.has(p.id),
  );

  console.log(
    `[AICommunityManager] Welcome: ${newProfiles.length} new, ${candidates.length} not yet welcomed`,
  );

  let welcomesSent = 0;

  for (const profile of candidates) {
    const vibeKey = profile.work_vibe || "default";
    const memberName = profile.display_name || "New Member";

    // Try template graduation before spending tokens on a live AI call
    const cachedText = await tryTemplateGraduation(
      supabase,
      "welcome_template",
      vibeKey,
      memberName,
    );

    let messageText: string;

    if (cachedText) {
      messageText = cachedText;

      // Log as template_cache hit -- zero AI cost
      await logAiUsage(supabase, "welcome", 0, 0, "template_cache");
    } else {
      const systemPrompt = `You are a warm community manager for DanaDone, a social coworking platform in Bangalore. Write a short personalized welcome message (2-3 sentences) for a new member. Reference their specific interests or work style when available. End with a concrete suggestion for their first session. Do not use placeholder brackets. Keep it genuine, not corporate.`;

      const userPrompt = `New member: ${memberName}
Work vibe: ${profile.work_vibe || "not set yet"}
Looking for: ${(profile.looking_for || []).join(", ") || "not listed yet"}
Can offer: ${(profile.can_offer || []).join(", ") || "not listed yet"}
Interests: ${(profile.interests || []).join(", ") || "not listed yet"}
Neighborhood: ${profile.neighborhood || "not set yet"}

Write a personalized welcome message for this new member.`;

      const result = await callClaude(apiKey, systemPrompt, userPrompt);
      if (!result) continue;

      messageText = result.text;

      // Store this fresh AI output as a template for future reuse
      await storeTemplate(
        supabase,
        "welcome_template",
        vibeKey,
        result.text,
        memberName,
      );

      await logAiUsage(
        supabase,
        "welcome",
        result.inputTokens,
        result.outputTokens,
      );
    }

    const title = `Welcome to DanaDone${profile.display_name ? `, ${profile.display_name}` : ""}!`;

    await supabase.from("notifications").insert({
      user_id: profile.id,
      type: "welcome",
      title,
      body: messageText,
      link: "/discover",
    });

    await supabase.from("notification_log").insert({
      user_id: profile.id,
      channel: "in_app",
      category: "welcome",
      title,
      body: messageText,
      status: "sent",
      metadata: {
        ai_generated: !cachedText,
        template_cached: !!cachedText,
      },
    });

    welcomesSent++;
  }

  console.log(`[AICommunityManager] Welcome: sent ${welcomesSent} messages`);
  return welcomesSent;
}

// ---- Task 3: Community prompts (Mondays only) ------------------------------

/**
 * Generates weekly discussion prompts based on what the community is actually
 * doing and talking about.
 *
 * WHY Monday-only: prompts are meant to kick off the work week. Running daily
 * would flood the prompts table and dilute engagement. The day-of-week check
 * uses UTC which is close enough to IST for a Monday gate.
 */
async function runCommunityPrompts(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
): Promise<number> {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();

  // 1 = Monday in JS Date (0 = Sunday)
  if (dayOfWeek !== 1) {
    console.log(
      `[AICommunityManager] Prompts: skipping, today is day ${dayOfWeek} (not Monday)`,
    );
    return 0;
  }

  const sevenDaysAgo = new Date(
    now.getTime() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Gather recent session titles for topic awareness
  const { data: recentEvents } = await supabase
    .from("events")
    .select("title, description")
    .gte("date", sevenDaysAgo.split("T")[0])
    .limit(20);

  const sessionTopics = (recentEvents || [])
    .map((e: { title: string; description?: string }) =>
      `${e.title}${e.description ? ` - ${e.description}` : ""}`,
    )
    .join("\n");

  // Gather popular interests from active profiles
  const thirtyDaysAgo = new Date(
    now.getTime() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: activeProfiles } = await supabase
    .from("profiles")
    .select("interests")
    .not("interests", "is", null)
    .gte("last_seen_at", thirtyDaysAgo)
    .limit(100);

  // Count interest frequency to surface what the community cares about
  const interestCounts: Record<string, number> = {};
  for (const p of activeProfiles || []) {
    for (const interest of (p.interests as string[]) || []) {
      interestCounts[interest] = (interestCounts[interest] || 0) + 1;
    }
  }

  const topInterests = Object.entries(interestCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([interest, count]) => `${interest} (${count} members)`)
    .join(", ");

  const systemPrompt = `You are a community manager for DanaDone, a social coworking platform in Bangalore where solo workers meet at cafes. Generate exactly 3 discussion prompts for the community's weekly thread. Each prompt should spark genuine conversation among coworkers — not generic motivational quotes. Keep each prompt to 1-2 sentences. Reference real topics from the community when possible. Format: return exactly 3 lines, one prompt per line, no numbering or bullet points.`;

  const userPrompt = `Recent session topics:
${sessionTopics || "No recent sessions found"}

Popular community interests: ${topInterests || "No interest data available"}

Generate 3 discussion prompts for this week.`;

  const result = await callClaude(apiKey, systemPrompt, userPrompt, 400);
  if (!result) return 0;

  // Split response into individual prompts, filtering out empty lines
  const promptTexts = result.text
    .split("\n")
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0)
    .slice(0, 3);

  if (promptTexts.length === 0) return 0;

  // Insert each prompt into the prompts table
  for (const text of promptTexts) {
    await supabase.from("prompts").insert({
      text,
      category: "weekly_discussion",
      is_active: true,
    });
  }

  await logAiUsage(
    supabase,
    "community_prompt",
    result.inputTokens,
    result.outputTokens,
  );

  console.log(
    `[AICommunityManager] Prompts: generated ${promptTexts.length} prompts`,
  );
  return promptTexts.length;
}

// ---- Main handler ----------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = (Deno.env.get("ANTHROPIC_API_KEY") || "").trim();
    if (!apiKey) {
      console.error("[AICommunityManager] ANTHROPIC_API_KEY not configured");
      return new Response(
        JSON.stringify({
          error: "ANTHROPIC_API_KEY not configured",
          churn_nudges: 0,
          welcomes: 0,
          prompts: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Parse requested action; default to running all tasks
    let action = "all";
    try {
      const body = await req.json();
      if (body?.action) {
        action = body.action;
      }
    } catch {
      // No body or invalid JSON -- run all tasks
    }

    const counts: TaskCounts = {
      churn_nudges: 0,
      welcomes: 0,
      prompts: 0,
    };

    if (action === "churn" || action === "all") {
      counts.churn_nudges = await runChurnPrediction(supabase, apiKey);
    }

    if (action === "welcome" || action === "all") {
      counts.welcomes = await runAutoWelcome(supabase, apiKey);
    }

    if (action === "prompts" || action === "all") {
      counts.prompts = await runCommunityPrompts(supabase, apiKey);
    }

    console.log("[AICommunityManager] Complete:", JSON.stringify(counts));

    return new Response(JSON.stringify(counts), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[AICommunityManager] Error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
