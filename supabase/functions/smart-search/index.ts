/**
 * @module smart-search Edge Function
 * @description LLM-powered natural language search for the DanaDone member
 * directory. Accepts a free-text query (e.g. "designers in HSR Layout who
 * like deep focus"), uses Claude to parse it into structured profile filters,
 * queries matching profiles, scores each result against the requesting user,
 * and returns the top 10 ranked results with match reasons.
 *
 * When the Anthropic API key is missing or the LLM call fails, the function
 * degrades gracefully to a simple text search (ilike on display_name, tagline,
 * can_offer, looking_for) so the feature is never fully broken.
 *
 * Cost reduction: Before calling Claude, we check the ai_cache table for a
 * previously parsed version of the same query (normalized for word order).
 * Cache hits skip the API call entirely, cutting per-query cost to zero.
 *
 * Tier gating: AI-powered parsing is a Pro+ feature. Free/Plus users still
 * get the endpoint but only receive basic text search (no LLM call). This
 * keeps the feature accessible while reserving the expensive AI path for
 * paying users.
 *
 * Key exports: None (Deno.serve handler)
 *
 * Dependencies:
 *   - Supabase (profiles, ai_usage_log, ai_cache, user_subscriptions, session_boosts)
 *   - Anthropic Messages API (claude-haiku-4-5-20251001)
 *
 * Tables used:
 *   - profiles  (read)  -- member data for search + scoring
 *   - ai_usage_log (insert) -- tracks every LLM / fallback / cache invocation
 *   - ai_cache (read/upsert) -- caches LLM parse results to avoid repeat API calls
 *   - user_subscriptions (read) -- checks tier for feature gating
 *   - session_boosts (read) -- temporary tier upgrades from day-pass purchases
 *
 * Auth: JWT required. user_id in the request body must match the
 * authenticated user to prevent impersonation.
 *
 * POST body: { query: string, user_id: string }
 * Response:  { results: SearchResult[], parsed_query: object, cache_hit: boolean }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// -- CORS ------------------------------------------------------------
// Allow browser requests from any origin during development.
// In production the Supabase proxy already handles CORS, but
// explicit headers prevent issues with direct function URLs.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// -- Types -----------------------------------------------------------

interface SearchRequest {
  query: string;
  user_id: string;
}

/** Structured filters extracted by the LLM from the raw query. */
interface ParsedQuery {
  work_vibe?: "deep_focus" | "casual_social" | "balanced";
  skills?: string[];
  needs?: string[];
  interests?: string[];
  neighborhood?: string;
  work_type?: string;
  keywords?: string[];
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  tagline: string | null;
  what_i_do: string | null;
  work_vibe: string | null;
  noise_preference: string | null;
  communication_style: string | null;
  neighborhood: string | null;
  work_type: string | null;
  looking_for: string[] | null;
  can_offer: string[] | null;
  interests: string[] | null;
  events_attended: number | null;
  focus_hours: number | null;
  gender: string | null;
}

interface SearchResult {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  tagline: string | null;
  work_vibe: string | null;
  match_score: number;
  match_reasons: string[];
  can_offer: string[] | null;
  looking_for: string[] | null;
}

// -- Neighborhood normalization --------------------------------------
// Mirrors src/lib/neighborhoods.ts normalizeNeighborhood().
// Duplicated here because Edge Functions cannot import from the
// Vite source tree -- keeping the logic identical prevents the
// slug-mismatch bug described in CLAUDE.md Decision #1.
function normalizeNeighborhood(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9\-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// -- Cache key normalization -----------------------------------------
// Normalize query into a canonical form so that word-order variations
// hit the same cache entry. "designers in HSR" and "HSR designers in"
// both become "designers hsr in". Single-character words (articles,
// prepositions) are dropped because they add no search value but would
// cause cache misses between e.g. "designers in HSR" and "designers HSR".
function normalizeCacheKey(query: string): string {
  return query.toLowerCase().split(/\s+/).filter(w => w.length >= 2).sort().join(" ");
}

// -- Tier check ------------------------------------------------------
// Pro tiers that unlock AI-powered search. Kept as a Set for O(1) lookup.
const PRO_TIERS = new Set(["pro", "max"]);

/**
 * Determine the user's effective tier, accounting for session boosts
 * (day-pass purchases that temporarily elevate tier). We check both
 * the subscription and any active boost, using whichever is higher.
 *
 * WHY service_role reads instead of RPC: The user_has_feature() RPC
 * relies on auth.uid() internally which returns null when called with
 * service_role key. Direct table reads with service_role bypass RLS
 * and give us the data we need.
 */
async function getEffectiveTier(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<string> {
  // Check the user's subscription tier
  const { data: sub } = await supabase
    .from("user_subscriptions")
    .select("tier_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  const userTier = sub?.tier_id || "free";

  // Check for an active session boost (temporary tier upgrade from day-pass)
  const { data: boost } = await supabase
    .from("session_boosts")
    .select("boost_tier")
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Use the boost tier if it's a Pro-level tier, otherwise use the subscription tier
  const effectiveTier =
    boost?.boost_tier && PRO_TIERS.has(boost.boost_tier)
      ? boost.boost_tier
      : userTier;

  return effectiveTier;
}

// -- Match scoring ---------------------------------------------------
// Simplified inline version of src/lib/matchUtils.ts
// calculateMatch(). Kept in sync manually -- the canonical
// weights live in ARCHITECTURE.md "Matching" section.
function calculateMatch(
  viewer: ProfileRow,
  member: ProfileRow
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const vibeLabels: Record<string, string> = {
    deep_focus: "Deep Focus",
    casual_social: "Casual Social",
    balanced: "Balanced",
  };

  // Same work vibe -- strongest signal that two people will coexist well
  if (viewer.work_vibe && viewer.work_vibe === member.work_vibe) {
    score += 20;
    reasons.push(
      `Same work vibe: ${vibeLabels[member.work_vibe] ?? member.work_vibe}`
    );
  }

  // Same neighborhood -- proximity matters for repeat sessions
  if (
    viewer.neighborhood &&
    member.neighborhood &&
    viewer.neighborhood === member.neighborhood
  ) {
    score += 15;
    reasons.push(`Both in ${member.neighborhood}`);
  }

  // They offer what you need -- the core "give/get" value prop
  const viewerLooking = viewer.looking_for ?? [];
  const memberOffers = member.can_offer ?? [];
  const lookingMatchOffers = viewerLooking.filter((t) =>
    memberOffers.includes(t)
  );
  score += lookingMatchOffers.length * 15;
  lookingMatchOffers.slice(0, 2).forEach((t) => {
    reasons.push(`They offer ${t} (you're looking for it!)`);
  });

  // You offer what they need -- mutual exchange potential
  const viewerOffers = viewer.can_offer ?? [];
  const memberLooking = member.looking_for ?? [];
  const offersMatchLooking = viewerOffers.filter((t) =>
    memberLooking.includes(t)
  );
  score += offersMatchLooking.length * 10;
  offersMatchLooking.slice(0, 2).forEach((t) => {
    reasons.push(`You can help them with ${t}`);
  });

  // Shared interests -- conversation starters and rapport
  const sharedInterests = (viewer.interests ?? []).filter((i) =>
    (member.interests ?? []).includes(i)
  );
  score += sharedInterests.length * 5;
  if (sharedInterests.length > 0) {
    reasons.push(
      `Shared interests: ${sharedInterests.slice(0, 3).join(", ")}`
    );
  }

  // Noise and communication style -- comfort-level alignment
  if (
    viewer.noise_preference &&
    viewer.noise_preference === member.noise_preference
  ) {
    score += 5;
  }
  if (
    viewer.communication_style &&
    viewer.communication_style === member.communication_style
  ) {
    score += 5;
  }

  return { score: Math.min(score, 100), reasons: reasons.slice(0, 4) };
}

// -- LLM query parsing -----------------------------------------------

const SYSTEM_PROMPT = `You are a search query parser for a coworking platform.
Extract structured filters from natural language queries.

Available fields:
- work_vibe: "deep_focus" | "casual_social" | "balanced"
- skills: string[] (maps to the can_offer column -- things a person can help with)
- needs: string[] (maps to the looking_for column -- things a person is seeking)
- interests: string[]
- neighborhood: string (normalized slug like "hsr-layout", lowercase with hyphens)
- work_type: string (e.g. "freelancer", "founder", "remote employee")

Return JSON only, no markdown fences, no explanation.
Schema: { work_vibe?, skills?, needs?, interests?, neighborhood?, work_type?, keywords? }
keywords is a fallback array of search terms if nothing maps cleanly to the structured fields.
Omit fields that are not relevant to the query rather than returning empty arrays.`;

/**
 * Call Claude to turn a natural-language query into structured filters.
 * Returns null when the API key is missing or the request fails --
 * the caller falls back to simple text search in that case.
 */
async function parseQueryWithLLM(
  query: string,
  apiKey: string
): Promise<{ parsed: ParsedQuery; inputTokens: number; outputTokens: number } | null> {
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        // Low temperature -- we want deterministic structured output, not creativity
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: query }],
      }),
    });

    if (!resp.ok) {
      console.error(
        `[SmartSearch] Anthropic API error: ${resp.status} ${resp.statusText}`
      );
      return null;
    }

    const data = await resp.json();
    const text: string = data.content?.[0]?.text || "";
    const inputTokens: number = data.usage?.input_tokens || 0;
    const outputTokens: number = data.usage?.output_tokens || 0;

    // Strip markdown code fences if the model wraps its response in them
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed: ParsedQuery = JSON.parse(cleaned);
    return { parsed, inputTokens, outputTokens };
  } catch (err) {
    console.error("[SmartSearch] LLM parse failed:", err);
    return null;
  }
}

// -- Database query builders -----------------------------------------

/**
 * Build a Supabase query using the structured filters from the LLM.
 * We fetch a generous set of candidates (up to 50) and let the match
 * scoring narrow them down -- this avoids over-constraining the DB
 * query when the LLM extracts multiple filters that might not all
 * be present on the same profile.
 */
function buildStructuredQuery(
  supabase: ReturnType<typeof createClient>,
  parsed: ParsedQuery,
  excludeUserId: string
) {
  const selectCols =
    "id, display_name, avatar_url, tagline, what_i_do, work_vibe, noise_preference, communication_style, neighborhood, work_type, looking_for, can_offer, interests, events_attended, focus_hours, gender";

  let query = supabase
    .from("profiles")
    .select(selectCols)
    .neq("id", excludeUserId)
    .not("display_name", "is", null)
    .limit(50);

  // Apply exact-match filters that are cheap and selective
  if (parsed.work_vibe) {
    query = query.eq("work_vibe", parsed.work_vibe);
  }

  if (parsed.neighborhood) {
    // Normalize before querying -- see CLAUDE.md Decision #1
    const slug = normalizeNeighborhood(parsed.neighborhood);
    query = query.eq("neighborhood", slug);
  }

  if (parsed.work_type) {
    query = query.ilike("work_type", `%${parsed.work_type}%`);
  }

  // Array containment filters for skills/needs/interests.
  // We use .overlaps() (the && operator) which returns rows
  // where the column shares at least one element with the input.
  // This is more forgiving than .contains() (the @> operator)
  // which would require ALL elements to be present.
  if (parsed.skills && parsed.skills.length > 0) {
    query = query.overlaps("can_offer", parsed.skills);
  }

  if (parsed.needs && parsed.needs.length > 0) {
    query = query.overlaps("looking_for", parsed.needs);
  }

  if (parsed.interests && parsed.interests.length > 0) {
    query = query.overlaps("interests", parsed.interests);
  }

  return query;
}

/**
 * Fallback text search when the LLM is unavailable.
 * Searches display_name, tagline, can_offer (cast), and
 * looking_for (cast) with simple ilike patterns.
 */
function buildFallbackQuery(
  supabase: ReturnType<typeof createClient>,
  rawQuery: string,
  excludeUserId: string
) {
  const selectCols =
    "id, display_name, avatar_url, tagline, what_i_do, work_vibe, noise_preference, communication_style, neighborhood, work_type, looking_for, can_offer, interests, events_attended, focus_hours, gender";

  // Split query into individual words for broader matching.
  // Each word becomes a separate ilike condition joined with OR.
  const words = rawQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  // Build OR conditions for each word across the searchable text columns
  const orConditions = words
    .map((word) => {
      const pattern = `%${word}%`;
      return [
        `display_name.ilike.${pattern}`,
        `tagline.ilike.${pattern}`,
        `what_i_do.ilike.${pattern}`,
        `work_vibe.ilike.${pattern}`,
        `work_type.ilike.${pattern}`,
      ].join(",");
    })
    .join(",");

  let query = supabase
    .from("profiles")
    .select(selectCols)
    .neq("id", excludeUserId)
    .not("display_name", "is", null)
    .limit(50);

  if (orConditions) {
    query = query.or(orConditions);
  }

  return query;
}

// -- Relevance boost -------------------------------------------------
// On top of the compatibility score, we boost results that
// directly match the parsed search criteria so that the
// search feels intentional, not just "people like you."

function calculateSearchRelevance(
  profile: ProfileRow,
  parsed: ParsedQuery
): number {
  let boost = 0;

  // Exact work_vibe match from the query -- user explicitly asked for this
  if (parsed.work_vibe && profile.work_vibe === parsed.work_vibe) {
    boost += 15;
  }

  // Neighborhood match -- user is looking in a specific area
  if (parsed.neighborhood) {
    const queriedSlug = normalizeNeighborhood(parsed.neighborhood);
    if (profile.neighborhood === queriedSlug) {
      boost += 10;
    }
  }

  // Skills overlap with what the user searched for
  const profileOffers = profile.can_offer ?? [];
  if (parsed.skills && parsed.skills.length > 0) {
    const hits = parsed.skills.filter((s) =>
      profileOffers.some(
        (o) => o.toLowerCase().includes(s.toLowerCase())
      )
    );
    boost += hits.length * 10;
  }

  // Needs overlap
  const profileLooking = profile.looking_for ?? [];
  if (parsed.needs && parsed.needs.length > 0) {
    const hits = parsed.needs.filter((n) =>
      profileLooking.some(
        (l) => l.toLowerCase().includes(n.toLowerCase())
      )
    );
    boost += hits.length * 10;
  }

  // Interests overlap
  const profileInterests = profile.interests ?? [];
  if (parsed.interests && parsed.interests.length > 0) {
    const hits = parsed.interests.filter((i) =>
      profileInterests.some(
        (pi) => pi.toLowerCase().includes(i.toLowerCase())
      )
    );
    boost += hits.length * 5;
  }

  // Keyword fallback -- case-insensitive substring match across text fields
  if (parsed.keywords && parsed.keywords.length > 0) {
    const searchable = [
      profile.display_name,
      profile.tagline,
      profile.what_i_do,
      ...(profile.can_offer ?? []),
      ...(profile.looking_for ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const hits = parsed.keywords.filter((kw) =>
      searchable.includes(kw.toLowerCase())
    );
    boost += hits.length * 5;
  }

  return boost;
}

// -- Main handler ----------------------------------------------------

Deno.serve(async (req) => {
  // CORS preflight -- browsers send OPTIONS before the actual POST
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // -- 1. Initialize Supabase with service role --------------------
    // Service role bypasses RLS -- needed so we can read any
    // profile and write to ai_usage_log regardless of the
    // requesting user's policies.
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // -- 2. Authenticate the caller ----------------------------------
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // -- 3. Parse and validate request body --------------------------
    const body: SearchRequest = await req.json();

    if (!body.query || typeof body.query !== "string") {
      return new Response(
        JSON.stringify({ error: "query is required and must be a string" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!body.user_id || typeof body.user_id !== "string") {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Prevent user A from searching as user B -- the match scoring
    // is personalized to the requesting user's profile, so allowing
    // impersonation would leak private compatibility data.
    if (body.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "user_id does not match authenticated user" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const query = body.query.trim();
    if (query.length === 0 || query.length > 500) {
      return new Response(
        JSON.stringify({
          error: "query must be between 1 and 500 characters",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // -- 4. Fetch the requesting user's profile ----------------------
    // We need the full profile to compute personalized match scores.
    const { data: viewerProfile, error: viewerError } = await supabase
      .from("profiles")
      .select(
        "id, display_name, avatar_url, tagline, what_i_do, work_vibe, noise_preference, communication_style, neighborhood, work_type, looking_for, can_offer, interests, events_attended, focus_hours, gender"
      )
      .eq("id", user.id)
      .single();

    if (viewerError || !viewerProfile) {
      return new Response(
        JSON.stringify({ error: "Could not load your profile" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // -- 5. Tier gate: AI parsing is Pro+ only -----------------------
    // WHY: Claude API calls cost money per query. Free/Plus users get
    // basic text search (still useful, just not AI-powered). Pro users
    // get the full LLM parse + cache pipeline. This progressively
    // reduces costs as the cache fills up from Pro user queries.
    const effectiveTier = await getEffectiveTier(supabase, user.id);
    const hasProAccess = PRO_TIERS.has(effectiveTier);

    // -- 6. Parse query -- cache / LLM / fallback --------------------
    const anthropicKey = (Deno.env.get("ANTHROPIC_API_KEY") || "").trim();
    let parsed: ParsedQuery = {};
    let usedLLM = false;
    let usedCache = false;
    let inputTokens = 0;
    let outputTokens = 0;

    // Only attempt AI parsing (cache or LLM) for Pro+ users
    if (hasProAccess && anthropicKey) {
      const cacheKey = normalizeCacheKey(query);

      // -- 6a. Check cache before calling Claude ---------------------
      // WHY cache: Identical or reordered queries are common (e.g.
      // "designers in HSR" vs "HSR designers"). By caching the LLM
      // parse result keyed on sorted-word form, we avoid paying for
      // the same parse twice. With temperature=0 the output is
      // deterministic, so cached results are identical to fresh ones.
      const { data: cached } = await supabase
        .from("ai_cache")
        .select("cache_value, id, hit_count")
        .eq("cache_type", "search_parse")
        .eq("cache_key", cacheKey)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (cached) {
        // Cache hit -- skip the API call entirely, saving ~$0.001 per query
        // Increment hit_count fire-and-forget so we can track cache effectiveness
        // without blocking the response on a non-critical write.
        supabase
          .from("ai_cache")
          .update({ hit_count: (cached.hit_count ?? 0) + 1 })
          .eq("id", cached.id)
          .then(() => {}); // fire-and-forget; errors are non-fatal
        parsed = cached.cache_value as ParsedQuery;
        usedCache = true;
      } else {
        // -- 6b. Cache miss -- call Claude ----------------------------
        const llmResult = await parseQueryWithLLM(query, anthropicKey);
        if (llmResult) {
          parsed = llmResult.parsed;
          inputTokens = llmResult.inputTokens;
          outputTokens = llmResult.outputTokens;
          usedLLM = true;

          // -- 6c. Store result in cache for future queries -----------
          // WHY 7-day TTL: Long enough to amortize cost across repeat
          // queries, short enough that if we update the system prompt
          // or model version the stale entries age out naturally.
          // Upsert on (cache_type, cache_key) so concurrent requests
          // for the same query don't create duplicate rows.
          if (Object.keys(parsed).length > 0) {
            supabase
              .from("ai_cache")
              .upsert(
                {
                  cache_type: "search_parse",
                  cache_key: cacheKey,
                  cache_value: parsed,
                  hit_count: 0,
                  expires_at: new Date(
                    Date.now() + 7 * 24 * 60 * 60 * 1000
                  ).toISOString(),
                },
                { onConflict: "cache_type,cache_key" }
              )
              .then(() => {}); // fire-and-forget; cache write failure is non-fatal
          }
        }
      }
    }

    // If AI parsing was not available (no Pro access, no API key, or
    // LLM failure), create a minimal parsed structure with keywords
    // so the fallback text search still works.
    if (!usedLLM && !usedCache) {
      parsed = {
        keywords: query
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length >= 2),
      };
    }

    // -- 7. Query the database ---------------------------------------
    let candidates: ProfileRow[] = [];

    if (usedLLM || usedCache) {
      const { data, error } = await buildStructuredQuery(
        supabase,
        parsed,
        user.id
      );
      if (error) {
        console.error("[SmartSearch] Structured query error:", error);
      }
      candidates = (data as ProfileRow[]) || [];

      // If the structured query was too narrow (common when the LLM
      // extracts very specific filters), fall back to a broader search
      // so the user still gets useful results.
      if (candidates.length < 3) {
        const { data: fallbackData } = await buildFallbackQuery(
          supabase,
          query,
          user.id
        );
        const fallbackProfiles = (fallbackData as ProfileRow[]) || [];
        const existingIds = new Set(candidates.map((c) => c.id));
        for (const p of fallbackProfiles) {
          if (!existingIds.has(p.id)) {
            candidates.push(p);
          }
        }
      }
    } else {
      // No AI parsing available -- pure text search
      const { data, error } = await buildFallbackQuery(
        supabase,
        query,
        user.id
      );
      if (error) {
        console.error("[SmartSearch] Fallback query error:", error);
      }
      candidates = (data as ProfileRow[]) || [];
    }

    // -- 8. Score and rank results -----------------------------------
    const scored: Array<SearchResult & { _sortScore: number }> = [];

    for (const candidate of candidates) {
      const matchResult = calculateMatch(viewerProfile as ProfileRow, candidate);
      const relevanceBoost = calculateSearchRelevance(candidate, parsed);

      // Combined score: compatibility with the viewer + how well they
      // match the actual search query. Capped at 100 for display.
      const combinedScore = Math.min(
        matchResult.score + relevanceBoost,
        100
      );

      scored.push({
        id: candidate.id,
        display_name: candidate.display_name,
        avatar_url: candidate.avatar_url,
        tagline: candidate.tagline,
        work_vibe: candidate.work_vibe,
        match_score: combinedScore,
        match_reasons: matchResult.reasons,
        can_offer: candidate.can_offer,
        looking_for: candidate.looking_for,
        // Internal sort key -- not returned to the client
        _sortScore: combinedScore,
      });
    }

    // Sort by combined score descending, take top 10
    scored.sort((a, b) => b._sortScore - a._sortScore);
    const top10 = scored.slice(0, 10);

    // Strip the internal sort key before returning
    const results: SearchResult[] = top10.map(
      ({ _sortScore, ...rest }) => rest
    );

    // -- 9. Log usage ------------------------------------------------
    // Track every invocation so we can monitor costs, cache hit rates,
    // and usage patterns. The source field distinguishes between cache
    // hits (free), AI calls (paid), and fallback (free but lower quality).
    await supabase.from("ai_usage_log").insert({
      task_type: "smart_search",
      source: usedCache ? "cache" : usedLLM ? "ai" : "fallback",
      provider_id: usedLLM ? "anthropic" : null,
      model: usedLLM ? "claude-haiku-4-5-20251001" : null,
      input_tokens: inputTokens || null,
      output_tokens: outputTokens || null,
    });

    // -- 10. Return results ------------------------------------------
    return new Response(
      JSON.stringify({
        results,
        parsed_query: parsed,
        cache_hit: usedCache,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[SmartSearch] Unhandled error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
