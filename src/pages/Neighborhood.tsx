import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { MapPin, Users, Coffee, UserPlus, Zap, ArrowRight, ChevronDown, Share2, Copy, Check, CalendarDays, Store, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { displayNeighborhood, normalizeNeighborhood, SEED_NEIGHBORHOODS } from "@/lib/neighborhoods";
import { getNeighborhoodActivationStatus, type NeighborhoodActivationStatus } from "@/lib/locationUtils";
import { getGrowthConfig } from "@/lib/growthConfig";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { toast } from "sonner";

/**
 * @page Neighborhood
 * @route /n/:slug
 * @description PUBLIC neighborhood landing page — no auth required.
 * This is the page people see when someone shares "danadone.club/n/koramangala".
 * Designed for SEO, social media sharing, and viral growth. Converts visitors to signups.
 *
 * Data sources (all public via anon key + RLS):
 * - profiles: member count + avatar stack
 * - events: sessions hosted count
 * - venue_nominations: active venues
 * - getNeighborhoodActivationStatus: unlock progress
 *
 * SEO: Dynamic document title, meta description, OG tags.
 */

interface MemberPreview {
  avatar_url: string | null;
  display_name: string | null;
}

interface VenuePreview {
  id: string;
  venue_name: string;
  address: string;
  photo_url: string | null;
}

interface NeighborhoodStats {
  memberCount: number;
  sessionsHosted: number;
  activeVenues: number;
}

const Neighborhood = () => {
  const { slug: rawSlug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const slug = normalizeNeighborhood(rawSlug || "");
  const displayName = displayNeighborhood(slug);

  usePageTitle(`Coworking in ${displayName} | DanaDone`);

  const [loading, setLoading] = useState(true);
  const [activation, setActivation] = useState<NeighborhoodActivationStatus | null>(null);
  const [stats, setStats] = useState<NeighborhoodStats>({ memberCount: 0, sessionsHosted: 0, activeVenues: 0 });
  const [memberPreviews, setMemberPreviews] = useState<MemberPreview[]>([]);
  const [venues, setVenues] = useState<VenuePreview[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  // ─── SEO meta tags ─────────────────────────
  useEffect(() => {
    const desc = `Find your coworking tribe in ${displayName}. Join ${stats.memberCount} members who work together at local cafes.`;
    const url = `https://danadone.club/n/${slug}`;

    // Set meta tags for SEO + social sharing
    const setMeta = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`) || document.querySelector(`meta[name="${property}"]`);
      if (!el) {
        el = document.createElement("meta");
        if (property.startsWith("og:")) {
          el.setAttribute("property", property);
        } else {
          el.setAttribute("name", property);
        }
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("description", desc);
    setMeta("og:title", `Coworking in ${displayName} | DanaDone`);
    setMeta("og:description", desc);
    setMeta("og:url", url);
    setMeta("og:type", "website");
    setMeta("og:site_name", "DanaDone");

    return () => {
      // Clean up OG tags on unmount to avoid leaking into other pages
      ["og:title", "og:description", "og:url", "og:type", "og:site_name"].forEach((prop) => {
        const el = document.querySelector(`meta[property="${prop}"]`);
        if (el) el.remove();
      });
    };
  }, [displayName, slug, stats.memberCount]);

  // ─── Fetch all data ────────────────────────
  useEffect(() => {
    if (!slug) return;

    const threshold = getGrowthConfig().growth.neighborhoodLaunchThreshold;

    const fetchAll = async () => {
      setLoading(true);

      // Run all queries in parallel
      const [activationResult, sessionsResult, venuesResult, membersResult] = await Promise.all([
        // 1. Activation status (includes member count)
        getNeighborhoodActivationStatus(slug, threshold),

        // 2. Sessions hosted in this neighborhood
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("neighborhood", slug),

        // 3. Active venues
        supabase
          .from("venue_nominations")
          .select("id, venue_name, address, photo_url")
          .eq("neighborhood", slug)
          .eq("status", "active"),

        // 4. Member avatar previews (limit to 5 for the stack)
        supabase
          .from("profiles")
          .select("avatar_url, display_name")
          .eq("neighborhood", slug)
          .eq("onboarding_completed", true)
          .limit(5),
      ]);

      const memberCount = activationResult.memberCount;
      const sessionsHosted = sessionsResult.count ?? 0;
      const activeVenuesList = (venuesResult.data || []) as VenuePreview[];
      const members = (membersResult.data || []) as MemberPreview[];

      // Determine if this neighborhood exists at all
      const isSeed = SEED_NEIGHBORHOODS.some((n) => n.slug === slug);
      if (memberCount === 0 && !isSeed && activeVenuesList.length === 0) {
        setNotFound(true);
      }

      setActivation(activationResult);
      setStats({
        memberCount,
        sessionsHosted,
        activeVenues: activeVenuesList.length,
      });
      setMemberPreviews(members);
      setVenues(activeVenuesList);
      setLoading(false);
    };

    fetchAll();
  }, [slug]);

  // ─── Share handlers ────────────────────────
  const pageUrl = `https://danadone.club/n/${slug}`;
  const shareText = `Coworking in ${displayName} — join the community on DanaDone!`;

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Coworking in ${displayName}`, text: shareText, url: pageUrl });
      } catch {
        // User cancelled share — not an error
      }
    } else {
      handleCopyLink();
    }
  }, [displayName, shareText, pageUrl]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(pageUrl).then(() => {
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    });
  }, [pageUrl]);

  const handleWhatsAppShare = useCallback(() => {
    const text = encodeURIComponent(`${shareText}\n${pageUrl}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }, [shareText, pageUrl]);

  const handleJoin = useCallback(() => {
    navigate(`/?neighborhood=${slug}`);
  }, [navigate, slug]);

  // ─── Loading state ─────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#1a1410' }}>
        <h1 className="text-4xl tracking-tight animate-pulse">
          <span className="font-serif" style={{ color: '#e07830' }}>Dana</span>
          <span className="font-sans font-bold" style={{ color: '#f5f0e8' }}>Done</span>
        </h1>
      </div>
    );
  }

  // ─── "Start coworking here" state ──────────
  // WHY: If this neighborhood has 0 members and isn't in the seed list, it's an unknown area.
  // Instead of a 404, show an aspirational page that lets them be the first to claim it.
  if (notFound) {
    return (
      <div className="min-h-screen font-body" style={{ background: 'linear-gradient(175deg, #1a1410 0%, #1e1814 100%)' }}>
        <nav className="flex items-center justify-between px-6 pt-6 sm:px-10 sm:pt-8">
          <a href="/" className="font-display text-2xl sm:text-3xl tracking-tight" style={{ color: '#f5f0e8', textDecoration: 'none' }}>
            <span style={{ fontWeight: 300, opacity: 0.5 }}>Dana</span>
            <span className="font-bold">Done</span>
          </a>
        </nav>
        <div className="flex flex-col items-center justify-center px-6 text-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
          <div
            className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full text-sm"
            style={{ background: 'rgba(224, 120, 48, 0.1)', color: '#e8a06a', border: '1px solid rgba(224, 120, 48, 0.15)' }}
          >
            <MapPin className="w-4 h-4" />
            {displayName}
          </div>
          <h2 className="font-display text-3xl sm:text-5xl mb-4" style={{ color: '#f5f0e8' }}>
            Start coworking in {displayName}
          </h2>
          <p className="text-sm sm:text-base max-w-md mb-8 leading-relaxed" style={{ color: 'rgba(245, 240, 232, 0.45)' }}>
            No one has started a coworking community here yet. Be the first — sign up and invite others in {displayName} to unlock sessions.
          </p>
          <button
            onClick={handleJoin}
            className="group inline-flex items-center gap-3 rounded-full px-6 py-3.5 sm:px-8 sm:py-4 text-sm sm:text-base font-medium transition-all duration-300 hover:-translate-y-0.5"
            style={{
              background: '#e07830',
              color: '#1a1410',
              boxShadow: '0 0 30px rgba(224, 120, 48, 0.2), 0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            Be the first here
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden font-body">

      {/* ═══════════════════════════════════════════════════════════
          HERO — Neighborhood identity + social proof
          ═══════════════════════════════════════════════════════════ */}
      <section
        className="relative min-h-screen flex flex-col"
        style={{
          background: 'radial-gradient(ellipse at 70% 20%, rgba(210, 120, 50, 0.07) 0%, transparent 60%), linear-gradient(175deg, #1a1410 0%, #1e1814 50%, #231d16 100%)',
        }}
      >
        {/* Grain texture */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.025]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Nav */}
        <nav className="relative z-10 flex items-center justify-between px-6 pt-6 sm:px-10 sm:pt-8">
          <a href="/" className="font-display text-2xl sm:text-3xl tracking-tight" style={{ color: '#f5f0e8', textDecoration: 'none' }}>
            <span style={{ fontWeight: 300, opacity: 0.5 }}>Dana</span>
            <span className="font-bold">Done</span>
          </a>
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm"
            style={{ border: '1px solid rgba(245, 240, 232, 0.1)', color: 'rgba(245, 240, 232, 0.4)' }}
          >
            <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            {displayName}
          </div>
        </nav>

        {/* Hero content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-6 sm:px-10 lg:px-16 max-w-3xl">

          {/* Neighborhood badge */}
          <div
            className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full text-sm w-fit animate-fade-up"
            style={{ background: 'rgba(210, 120, 50, 0.12)', color: '#e8a06a', border: '1px solid rgba(210, 120, 50, 0.15)' }}
          >
            <MapPin className="w-4 h-4" />
            {displayName}
          </div>

          {/* Headline */}
          <h1
            className="font-display text-[2.75rem] sm:text-6xl lg:text-7xl leading-[1.05] mb-6 animate-fade-up"
            style={{ color: '#f5f0e8' }}
          >
            Coworking in{' '}
            <span style={{ color: '#e07830' }}>{displayName}</span>
          </h1>

          {/* Sub-copy — changes based on activation status */}
          <p
            className="text-base sm:text-lg leading-relaxed mb-6 max-w-lg animate-fade-up"
            style={{ color: 'rgba(245, 240, 232, 0.5)', animationDelay: '0.1s', opacity: 0 }}
          >
            {activation?.isUnlocked
              ? `Join ${stats.memberCount} members who cowork together at verified local spots in ${displayName}.`
              : `${stats.memberCount} members are building a coworking community in ${displayName}. Join them to unlock sessions.`
            }
          </p>

          {/* Member avatar stack + count */}
          {memberPreviews.length > 0 && (
            <div className="flex items-center gap-3 mb-8 animate-fade-up" style={{ animationDelay: '0.15s', opacity: 0 }}>
              <div className="flex -space-x-2">
                {memberPreviews.map((m, i) => (
                  <Avatar key={i} className="w-8 h-8 border-2" style={{ borderColor: '#1a1410' }}>
                    <AvatarImage src={m.avatar_url || ""} />
                    <AvatarFallback className="text-xs" style={{ background: '#2a2420', color: '#a89880' }}>
                      {getInitials(m.display_name)}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <span style={{ color: 'rgba(245, 240, 232, 0.4)', fontSize: '0.875rem' }}>
                <span style={{ color: '#f5f0e8', fontWeight: 500 }}>{stats.memberCount}</span>
                {' '}member{stats.memberCount !== 1 ? 's' : ''} already here
              </span>
            </div>
          )}

          {/* Activation progress bar — only shown if not yet unlocked */}
          {activation && !activation.isUnlocked && (
            <div className="max-w-sm mb-8 animate-fade-up" style={{ animationDelay: '0.18s', opacity: 0 }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium" style={{ color: '#e8a06a' }}>
                  {activation.membersNeeded} more to unlock
                </span>
                <span className="text-xs" style={{ color: 'rgba(245, 240, 232, 0.3)' }}>
                  {activation.progressPercent}%
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(245, 240, 232, 0.08)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${activation.progressPercent}%`,
                    background: 'linear-gradient(90deg, #e07830, #e8a06a)',
                  }}
                />
              </div>
              <p className="text-xs mt-2" style={{ color: 'rgba(245, 240, 232, 0.25)' }}>
                Join to help unlock coworking sessions in {displayName}
              </p>
            </div>
          )}

          {/* Unlocked badge — shown when neighborhood is active */}
          {activation?.isUnlocked && stats.sessionsHosted > 0 && (
            <div
              className="inline-flex items-center gap-2 mb-8 px-3 py-1.5 rounded-full text-xs w-fit animate-fade-up"
              style={{
                background: 'rgba(34, 197, 94, 0.1)',
                color: 'rgb(74, 222, 128)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
                animationDelay: '0.18s',
                opacity: 0,
              }}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              {stats.sessionsHosted} session{stats.sessionsHosted !== 1 ? 's' : ''} hosted
            </div>
          )}

          {/* CTA */}
          <div className="animate-fade-up" style={{ animationDelay: '0.2s', opacity: 0 }}>
            <button
              onClick={handleJoin}
              className="group inline-flex items-center gap-3 rounded-full px-6 py-3.5 sm:px-8 sm:py-4 text-sm sm:text-base font-medium transition-all duration-300 hover:-translate-y-0.5"
              style={{
                background: '#e07830',
                color: '#1a1410',
                boxShadow: '0 0 30px rgba(224, 120, 48, 0.2), 0 4px 12px rgba(0,0,0,0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 0 40px rgba(224, 120, 48, 0.35), 0 6px 20px rgba(0,0,0,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 0 30px rgba(224, 120, 48, 0.2), 0 4px 12px rgba(0,0,0,0.3)';
              }}
            >
              Join {displayName}
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="relative z-10 flex justify-center pb-8 animate-bounce" style={{ animationDuration: '2s' }}>
          <ChevronDown className="w-5 h-5" style={{ color: 'rgba(245, 240, 232, 0.15)' }} />
        </div>
      </section>


      {/* ═══════════════════════════════════════════════════════════
          SOCIAL PROOF STATS — Member count, sessions, venues
          ═══════════════════════════════════════════════════════════ */}
      {(stats.memberCount > 0 || stats.sessionsHosted > 0 || stats.activeVenues > 0) && (
        <section className="py-16 sm:py-20 px-6 sm:px-10" style={{ background: 'hsl(var(--card))' }}>
          <div className="max-w-2xl mx-auto">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <span className="block font-display text-2xl sm:text-3xl" style={{ color: '#e07830' }}>
                  {stats.memberCount}
                </span>
                <span className="text-xs sm:text-sm text-muted-foreground font-body">
                  Member{stats.memberCount !== 1 ? 's' : ''}
                </span>
              </div>
              <div>
                <span className="block font-display text-2xl sm:text-3xl" style={{ color: '#e07830' }}>
                  {stats.sessionsHosted}
                </span>
                <span className="text-xs sm:text-sm text-muted-foreground font-body">
                  Session{stats.sessionsHosted !== 1 ? 's' : ''} hosted
                </span>
              </div>
              <div>
                <span className="block font-display text-2xl sm:text-3xl" style={{ color: '#e07830' }}>
                  {stats.activeVenues}
                </span>
                <span className="text-xs sm:text-sm text-muted-foreground font-body">
                  Active venue{stats.activeVenues !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}


      {/* ═══════════════════════════════════════════════════════════
          HOW IT WORKS — 3 steps, contextualized to this neighborhood
          ═══════════════════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28 px-6 sm:px-10 bg-background">
        <div className="max-w-2xl mx-auto">
          <h3 className="font-display text-3xl sm:text-4xl text-center mb-14">
            How it works in {displayName}
          </h3>

          <div className="space-y-0">
            {[
              { num: "01", title: `Join DanaDone in ${displayName}`, desc: "Sign up free with Google. Tell us your work style and what you're looking for.", icon: UserPlus },
              { num: "02", title: "Get matched with 3\u20135 people", desc: "We find compatible coworkers nearby — same vibe, complementary skills.", icon: Sparkles },
              { num: "03", title: "Cowork at verified local spots", desc: `Meet at community-verified cafes and coworking spaces in ${displayName}.`, icon: Coffee },
            ].map((step, i) => (
              <div
                key={step.num}
                className="flex items-start gap-5 sm:gap-6 py-6"
                style={{ borderBottom: i < 2 ? '1px solid hsl(var(--border))' : 'none' }}
              >
                <span className="text-xs font-medium mt-1.5" style={{ color: '#e07830' }}>
                  {step.num}
                </span>
                <div className="flex-1">
                  <h4 className="font-display text-lg mb-1">{step.title}</h4>
                  <p className="text-muted-foreground text-sm leading-relaxed font-body">{step.desc}</p>
                </div>
                <step.icon className="w-5 h-5 mt-1.5 flex-shrink-0" style={{ color: 'rgba(224, 120, 48, 0.35)' }} />
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ═══════════════════════════════════════════════════════════
          VENUES — Active venues in this neighborhood
          ═══════════════════════════════════════════════════════════ */}
      {venues.length > 0 && (
        <section className="py-20 sm:py-28 px-6 sm:px-10" style={{ background: 'hsl(var(--card))' }}>
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Store className="w-5 h-5" style={{ color: '#e07830' }} />
            </div>
            <h3 className="font-display text-3xl sm:text-4xl text-center mb-4">
              Verified venues in {displayName}
            </h3>
            <p className="text-center text-muted-foreground text-sm mb-10 font-body">
              Community-nominated and verified by real coworkers
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {venues.map((venue) => (
                <div
                  key={venue.id}
                  className="rounded-xl overflow-hidden transition-shadow hover:shadow-md"
                  style={{ background: 'hsl(var(--background))' }}
                >
                  {/* Venue photo or placeholder */}
                  {venue.photo_url ? (
                    <div className="h-36 overflow-hidden">
                      <img
                        src={venue.photo_url}
                        alt={venue.venue_name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div
                      className="h-36 flex items-center justify-center"
                      style={{ background: 'rgba(224, 120, 48, 0.06)' }}
                    >
                      <Coffee className="w-8 h-8" style={{ color: 'rgba(224, 120, 48, 0.25)' }} />
                    </div>
                  )}
                  <div className="p-4">
                    <h4 className="font-display text-base mb-1">{venue.venue_name}</h4>
                    <p className="text-muted-foreground text-xs leading-relaxed font-body line-clamp-2">
                      {venue.address}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}


      {/* ═══════════════════════════════════════════════════════════
          SHARE — Viral growth: WhatsApp + copy link + native share
          ═══════════════════════════════════════════════════════════ */}
      <section
        className="py-20 sm:py-28 px-6 sm:px-10"
        style={{
          background: 'radial-gradient(ellipse at 30% 80%, rgba(210, 120, 50, 0.06) 0%, transparent 60%), linear-gradient(175deg, #1a1410 0%, #1e1814 100%)',
        }}
      >
        <div className="max-w-md mx-auto text-center">
          <h3 className="font-display text-2xl sm:text-3xl mb-3" style={{ color: '#f5f0e8' }}>
            Know people who work in {displayName}?
          </h3>
          <p className="text-sm mb-8 font-body" style={{ color: 'rgba(245, 240, 232, 0.4)' }}>
            Share this page and help build the coworking community
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {/* WhatsApp share */}
            <button
              onClick={handleWhatsAppShare}
              className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium transition-all duration-300 hover:-translate-y-0.5 w-full sm:w-auto justify-center"
              style={{
                background: 'rgba(37, 211, 102, 0.12)',
                color: 'rgb(37, 211, 102)',
                border: '1px solid rgba(37, 211, 102, 0.25)',
              }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Share on WhatsApp
            </button>

            {/* Copy link */}
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium transition-all duration-300 hover:-translate-y-0.5 w-full sm:w-auto justify-center"
              style={{
                background: 'transparent',
                color: '#e8a06a',
                border: '1px solid rgba(224, 120, 48, 0.35)',
              }}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy link'}
            </button>

            {/* Native share (shows on mobile) */}
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium transition-all duration-300 hover:-translate-y-0.5 w-full sm:w-auto justify-center"
                style={{
                  background: 'transparent',
                  color: 'rgba(245, 240, 232, 0.5)',
                  border: '1px solid rgba(245, 240, 232, 0.12)',
                }}
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
            )}
          </div>
        </div>
      </section>


      {/* ═══════════════════════════════════════════════════════════
          FINAL CTA — Large sign-up button
          ═══════════════════════════════════════════════════════════ */}
      <section
        className="py-20 sm:py-28 px-6 sm:px-10 text-center"
        style={{ background: 'linear-gradient(to bottom, #1a1410, #1e1814)' }}
      >
        <h3 className="font-display text-3xl sm:text-4xl mb-4" style={{ color: '#f5f0e8' }}>
          {activation?.isUnlocked
            ? `Your table in ${displayName} is waiting.`
            : `Help unlock ${displayName}.`
          }
        </h3>
        <p className="text-sm mb-8 font-body" style={{ color: 'rgba(245, 240, 232, 0.4)' }}>
          {activation?.isUnlocked
            ? 'Free to join. No credit card needed.'
            : `${activation?.membersNeeded ?? 0} more member${(activation?.membersNeeded ?? 0) !== 1 ? 's' : ''} needed to start sessions.`
          }
        </p>

        <button
          onClick={handleJoin}
          className="group inline-flex items-center gap-3 rounded-full px-6 py-3.5 sm:px-8 sm:py-4 text-sm sm:text-base font-medium transition-all duration-300 hover:-translate-y-0.5"
          style={{
            background: '#e07830',
            color: '#1a1410',
            boxShadow: '0 0 30px rgba(224, 120, 48, 0.2), 0 4px 12px rgba(0,0,0,0.3)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 0 40px rgba(224, 120, 48, 0.35), 0 6px 20px rgba(0,0,0,0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 0 30px rgba(224, 120, 48, 0.2), 0 4px 12px rgba(0,0,0,0.3)';
          }}
        >
          Join {displayName}
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </button>

        {/* Stats reinforcement */}
        {stats.memberCount > 0 && (
          <div className="flex items-center justify-center gap-4 mt-8 font-body" style={{ color: 'rgba(245, 240, 232, 0.3)', fontSize: '0.8125rem' }}>
            <span>{stats.memberCount} member{stats.memberCount !== 1 ? 's' : ''}</span>
            {stats.sessionsHosted > 0 && (
              <>
                <span style={{ opacity: 0.4 }}>&middot;</span>
                <span>{stats.sessionsHosted} session{stats.sessionsHosted !== 1 ? 's' : ''} hosted</span>
              </>
            )}
          </div>
        )}
      </section>


      {/* Footer */}
      <footer className="py-8 px-6 text-center" style={{ background: '#1a1410' }}>
        <a href="/" className="font-display text-lg mb-3 block" style={{ color: 'rgba(245, 240, 232, 0.25)', textDecoration: 'none' }}>
          <span style={{ fontWeight: 300 }}>Dana</span>
          <span className="font-bold">Done</span>
        </a>
        <div className="flex items-center justify-center gap-4 text-xs font-body" style={{ color: 'rgba(245, 240, 232, 0.15)' }}>
          <a href="/" className="hover:opacity-60 transition-opacity">Home</a>
          <span>&middot;</span>
          <a href="/partners" className="hover:opacity-60 transition-opacity">Partner Venues</a>
          <span>&middot;</span>
          <span>Built with coffee</span>
        </div>
      </footer>
    </div>
  );
};

export default Neighborhood;
