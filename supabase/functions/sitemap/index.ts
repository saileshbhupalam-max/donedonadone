/**
 * @function sitemap
 * @description Generates a dynamic XML sitemap including all active neighborhood pages.
 *
 * WHY a dynamic sitemap: Static sitemaps can't include user-created neighborhoods.
 * As DanaDone expands globally, each new neighborhood gets a /n/:slug page that
 * Google needs to discover. This function generates the sitemap on-the-fly from
 * DB data, ensuring every neighborhood page is indexed.
 *
 * Called by: Vercel rewrite rule (/sitemap.xml → this function)
 * Or directly: https://<project>.supabase.co/functions/v1/sitemap
 *
 * pg_cron: Not needed — called on-demand by crawlers.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = "https://danadone.club";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    // WHY anon key: sitemap is public data. Using service_role would be a security risk
    // since this endpoint is unauthenticated.
    Deno.env.get("SUPABASE_ANON_KEY")!
  );

  // Static pages with their priorities and change frequencies
  const staticPages = [
    { path: "/", priority: "1.0", changefreq: "weekly" },
    { path: "/partners", priority: "0.6", changefreq: "monthly" },
  ];

  // Fetch all neighborhoods that have at least 1 member
  const { data: neighborhoods } = await supabase
    .from("neighborhood_stats")
    .select("neighborhood, member_count, updated_at")
    .gt("member_count", 0)
    .order("member_count", { ascending: false });

  // Fetch public venue pages
  const { data: venues } = await supabase
    .from("venue_partners")
    .select("id, updated_at")
    .eq("status", "approved");

  const now = new Date().toISOString().split("T")[0];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  // Static pages
  for (const page of staticPages) {
    xml += `  <url>
    <loc>${SITE_URL}${page.path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
  }

  // Neighborhood pages — higher priority for active neighborhoods
  if (neighborhoods) {
    for (const n of neighborhoods) {
      const lastmod = n.updated_at
        ? new Date(n.updated_at).toISOString().split("T")[0]
        : now;
      // WHY variable priority: Neighborhoods with more members are more useful
      // to searchers and should be crawled more frequently.
      const priority = n.member_count >= 10 ? "0.8" : "0.5";
      const changefreq = n.member_count >= 10 ? "weekly" : "monthly";

      xml += `  <url>
    <loc>${SITE_URL}/n/${n.neighborhood}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>
`;
    }
  }

  // Public venue insight pages
  if (venues) {
    for (const v of venues) {
      const lastmod = v.updated_at
        ? new Date(v.updated_at).toISOString().split("T")[0]
        : now;
      xml += `  <url>
    <loc>${SITE_URL}/space/${v.id}/insights</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
`;
    }
  }

  xml += `</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // WHY 1 hour cache: Neighborhoods don't change faster than hourly.
      // Caching reduces DB queries from crawler storms (Google can hit sitemaps
      // 100+ times per day during initial discovery).
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
});
