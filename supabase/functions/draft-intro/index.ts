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

    // Verify auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Not authenticated");

    const { from_company_id, to_company_id } = await req.json();
    if (!from_company_id || !to_company_id) throw new Error("from_company_id and to_company_id required");

    // Verify user is member of from_company
    const { data: membership } = await supabase
      .from("company_members")
      .select("id")
      .eq("company_id", from_company_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) throw new Error("Not a member of the source company");

    // Fetch both companies
    const [{ data: fromCo }, { data: toCo }] = await Promise.all([
      supabase.from("companies").select("name, one_liner, industry_tags").eq("id", from_company_id).single(),
      supabase.from("companies").select("name, one_liner, industry_tags").eq("id", to_company_id).single(),
    ]);

    // Fetch needs/offers
    const [{ data: fromNeeds }, { data: fromOffers }, { data: toNeeds }, { data: toOffers }] = await Promise.all([
      supabase.from("company_needs").select("title, need_type").eq("company_id", from_company_id).eq("is_active", true),
      supabase.from("company_offers").select("title, offer_type").eq("company_id", from_company_id).eq("is_active", true),
      supabase.from("company_needs").select("title, need_type").eq("company_id", to_company_id).eq("is_active", true),
      supabase.from("company_offers").select("title, offer_type").eq("company_id", to_company_id).eq("is_active", true),
    ]);

    // Fetch AI config
    const { data: config } = await supabase
      .from("ai_task_config")
      .select("*, ai_providers(*)")
      .eq("task_type", "intro_draft")
      .single();

    if (!config?.is_active || !config?.ai_providers?.is_active) {
      // Fallback template
      const draft = `Hi ${toCo?.name || "there"}! We're ${fromCo?.name || "a company"} — ${fromCo?.one_liner || "working on exciting things"}. We'd love to explore potential synergies and see how we could collaborate.`;
      return new Response(JSON.stringify({ draft }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const provider = config.ai_providers;
    const apiKey = Deno.env.get(provider.api_key_env);

    if (!apiKey) {
      const draft = `Hi ${toCo?.name || "there"}! We're ${fromCo?.name || "a company"} and think there could be great synergy between our teams. Would love to connect!`;
      return new Response(JSON.stringify({ draft }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `From company: ${fromCo?.name} — "${fromCo?.one_liner || "N/A"}"
Industries: ${(fromCo?.industry_tags || []).join(", ") || "N/A"}
Needs: ${(fromNeeds || []).map((n: any) => n.title).join(", ") || "None listed"}
Offers: ${(fromOffers || []).map((o: any) => o.title).join(", ") || "None listed"}

To company: ${toCo?.name} — "${toCo?.one_liner || "N/A"}"
Industries: ${(toCo?.industry_tags || []).join(", ") || "N/A"}
Needs: ${(toNeeds || []).map((n: any) => n.title).join(", ") || "None listed"}
Offers: ${(toOffers || []).map((o: any) => o.title).join(", ") || "None listed"}

Write an intro message from ${fromCo?.name} to ${toCo?.name}.`;

    let draft = "";

    if (provider.id === "anthropic") {
      const resp = await fetch(`${provider.base_url}/messages`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "content-type": "application/json",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: config.max_tokens,
          temperature: Number(config.temperature),
          system: config.system_prompt,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        draft = data.content?.[0]?.text || "";
      }
    } else {
      const resp = await fetch(`${provider.base_url}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          temperature: Number(config.temperature),
          max_tokens: config.max_tokens,
          messages: [
            { role: "system", content: config.system_prompt },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        draft = data.choices?.[0]?.message?.content || "";
      }
    }

    // Log usage
    await supabase.from("ai_usage_log").insert({
      task_type: "intro_draft",
      source: draft ? "ai" : "template",
      provider_id: provider.id,
      model: config.model,
    });

    if (!draft) {
      draft = `Hi ${toCo?.name || "there"}! We're ${fromCo?.name || "a company"} and think there could be great synergy between our teams. Would love to connect!`;
    }

    return new Response(JSON.stringify({ draft }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("draft-intro error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
