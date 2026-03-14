import { MapPin, Shield, Lock, Users, Coffee, UserPlus, Zap, ChevronDown, Sparkles, CalendarDays, ArrowRight, Clock, CheckCircle, Star, Store } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { usePageTitle } from "@/hooks/usePageTitle";
import { ERROR_STATES } from "@/lib/personality";

/**
 * Landing page — CXL ResearchXL framework + neuromarketing optimized.
 *
 * Principles applied:
 * - 5-second test: instantly communicates "group coworking at cafés"
 * - Z-pattern hero: logo top-left → location top-right → headline → CTA
 * - Loss-framed copy: "Stop working alone" (loss aversion > gain framing)
 * - Von Restorff effect: single bright amber CTA, nothing competing
 * - Processing fluency: short sentences, generous whitespace, high contrast
 * - Social proof near CTA: real member/session counts
 * - Trust signals: women-only, verified, private reporting
 * - How it works: exactly 3 steps (cognitive load minimized)
 * - Mobile-first, no horizontal overflow
 */

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const Index = () => {
  usePageTitle("DanaDone — work. connect. grow.");
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [signingIn, setSigningIn] = useState(false);
  const [referrer, setReferrer] = useState<{ display_name: string | null; avatar_url: string | null } | null>(null);
  const [venueInfo, setVenueInfo] = useState<{ venue_name: string; neighborhood: string | null } | null>(null);
  const [stats, setStats] = useState<{ members: number; sessions: number; props: number }>({ members: 0, sessions: 0, props: 0 });

  // Store referral code and venue from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    const venueId = params.get("venue");
    if (ref) {
      localStorage.setItem("fc_ref", ref);
      supabase.from("profiles").select("display_name, avatar_url").eq("referral_code", ref).single()
        .then(({ data }) => { if (data) setReferrer(data); });
    }
    if (venueId) {
      localStorage.setItem("fc_venue", venueId);
      supabase.from("venue_scans").insert({ venue_partner_id: venueId })
        .then(({ error }) => { if (error) console.error("[venue_scans]", error.message); });
      supabase.from("venue_partners").select("venue_name, neighborhood").eq("id", venueId).single()
        .then(({ data }: any) => { if (data) setVenueInfo(data); });
    }
  }, []);

  // Fetch community stats
  useEffect(() => {
    Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("onboarding_completed", true),
      supabase.from("events").select("id", { count: "exact", head: true }),
      supabase.from("peer_props").select("id", { count: "exact", head: true }),
    ]).then(([profilesRes, eventsRes, propsRes]) => {
      setStats({
        members: profilesRes.count ?? 0,
        sessions: eventsRes.count ?? 0,
        props: propsRes.count ?? 0,
      });
    });
  }, []);

  // Check if we're returning from OAuth — implicit flow uses hash,
  // PKCE flow uses query param. Either way, show a loader until auth resolves.
  const hasAuthCallback =
    window.location.hash.includes("access_token") ||
    new URLSearchParams(window.location.search).has("code");

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      if (profile?.onboarding_completed) {
        navigate("/home", { replace: true });
      } else {
        navigate("/onboarding", { replace: true });
      }
    }
  }, [user, profile, loading, navigate]);

  // Show loading while processing OAuth callback
  if (hasAuthCallback || (loading && !user)) {
    return (
      <div className="min-h-screen bg-[#1a1108] flex items-center justify-center">
        <h1 className="text-4xl tracking-tight animate-pulse">
          <span className="font-serif text-[#e07830]">Dana</span>
          <span className="font-sans font-bold text-[#f5f0e8]">Done</span>
        </h1>
      </div>
    );
  }

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}` },
      });
      if (error) {
        toast.error(ERROR_STATES.generic);
        console.error("Sign in error:", error);
      }
    } catch (error) {
      toast.error(ERROR_STATES.generic);
      console.error("Sign in error:", error);
    } finally {
      setSigningIn(false);
    }
  };

  // --- Loading state ---
  if (loading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-3"
        style={{ background: '#1a1410' }}
      >
        <h1 className="font-display text-4xl tracking-tight animate-pulse" style={{ color: '#f5f0e8' }}>
          <span style={{ fontWeight: 300 }}>Dana</span>
          <span className="font-bold">Done</span>
        </h1>
      </div>
    );
  }

  // --- CTA button (reused across sections, Von Restorff: single warm accent) ---
  const CTAButton = ({ className = "" }: { className?: string }) => (
    <button
      onClick={handleGoogleSignIn}
      disabled={signingIn}
      className={`group inline-flex items-center gap-3 rounded-full px-6 py-3.5 sm:px-8 sm:py-4 text-sm sm:text-base font-medium font-body transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50 ${className}`}
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
      <GoogleIcon />
      {signingIn ? "One sec..." : "Join free with Google"}
      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
    </button>
  );

  return (
    <div className="min-h-screen overflow-x-hidden font-body">

      {/* ═══════════════════════════════════════════════════════════
          HERO — Full viewport, warm dark, Z-pattern layout
          Eye path: Logo (top-left) → Location (top-right) →
                    Headline (center-left) → CTA (below headline)
          ═══════════════════════════════════════════════════════════ */}
      <section
        className="relative min-h-screen flex flex-col"
        style={{
          background: 'radial-gradient(ellipse at 70% 20%, rgba(210, 120, 50, 0.07) 0%, transparent 60%), linear-gradient(175deg, #1a1410 0%, #1e1814 50%, #231d16 100%)',
        }}
      >
        {/* Subtle grain texture for warmth */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.025]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Z-pattern start: Logo top-left, Location top-right */}
        <nav className="relative z-10 flex items-center justify-between px-6 pt-6 sm:px-10 sm:pt-8">
          <h1 className="font-display text-2xl sm:text-3xl tracking-tight" style={{ color: '#f5f0e8' }}>
            <span style={{ fontWeight: 300, opacity: 0.5 }}>Dana</span>
            <span className="font-bold">Done</span>
          </h1>

          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-body"
            style={{
              border: '1px solid rgba(245, 240, 232, 0.1)',
              color: 'rgba(245, 240, 232, 0.4)',
            }}
          >
            <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            HSR Layout, Bangalore
          </div>
        </nav>

        {/* Hero content — left-aligned for Z-pattern flow */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-6 sm:px-10 lg:px-16 max-w-3xl">

          {/* Venue badge (contextual — only shows if user scanned a venue QR) */}
          {venueInfo && (
            <div
              className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full text-sm w-fit animate-fade-up"
              style={{
                background: 'rgba(210, 120, 50, 0.12)',
                color: '#e8a06a',
                border: '1px solid rgba(210, 120, 50, 0.15)',
              }}
            >
              <Coffee className="w-4 h-4" />
              You were invited to {venueInfo.venue_name}
            </div>
          )}

          {/* Loss-framed headline — "Stop" triggers loss aversion */}
          <h2
            className="font-display text-[2.75rem] sm:text-6xl lg:text-7xl leading-[1.05] mb-6 animate-fade-up"
            style={{ color: '#f5f0e8' }}
          >
            Stop working{' '}
            <span className="font-display italic" style={{ opacity: 0.35 }}>alone.</span>
          </h2>

          {/* Value prop — one sentence, high processing fluency */}
          <p
            className="font-body text-base sm:text-lg leading-relaxed mb-8 max-w-lg animate-fade-up"
            style={{
              color: 'rgba(245, 240, 232, 0.5)',
              animationDelay: '0.1s',
              opacity: 0,
            }}
          >
            {venueInfo
              ? `Join the community coworking at ${venueInfo.venue_name} and other great spots across Bangalore.`
              : "We match you with 3\u20135 people at cafés and coworking spaces. You focus. You connect. You come back."}
          </p>

          {/* Referrer social proof (if referred) */}
          {referrer && (
            <div className="flex items-center gap-3 mb-6 animate-fade-up" style={{ animationDelay: '0.15s', opacity: 0 }}>
              <Avatar className="w-8 h-8 ring-2 ring-white/10">
                <AvatarImage src={referrer.avatar_url || ""} />
                <AvatarFallback className="text-xs" style={{ background: '#2a2420', color: '#a89880' }}>
                  {getInitials(referrer.display_name)}
                </AvatarFallback>
              </Avatar>
              <span style={{ color: 'rgba(245, 240, 232, 0.4)', fontSize: '0.875rem' }}>
                Invited by{' '}
                <span style={{ color: '#f5f0e8', fontWeight: 500 }}>{referrer.display_name}</span>
              </span>
            </div>
          )}

          {/* Von Restorff CTA — the ONLY colored element in the hero */}
          <div className="animate-fade-up" style={{ animationDelay: '0.2s', opacity: 0 }}>
            <CTAButton />
          </div>

          {/* Social proof near CTA — reduces friction */}
          {(stats.members > 0 || stats.sessions > 0) && (
            <div
              className="flex items-center gap-4 mt-8 animate-fade-up font-body"
              style={{ animationDelay: '0.3s', opacity: 0, color: 'rgba(245, 240, 232, 0.3)', fontSize: '0.8125rem' }}
            >
              {stats.members > 0 && <span>{stats.members}+ members</span>}
              {stats.members > 0 && stats.sessions > 0 && <span style={{ opacity: 0.4 }}>·</span>}
              {stats.sessions > 0 && <span>{stats.sessions}+ sessions hosted</span>}
            </div>
          )}
        </div>

        {/* Scroll hint */}
        <div className="relative z-10 flex justify-center pb-8 animate-bounce" style={{ animationDuration: '2s' }}>
          <ChevronDown className="w-5 h-5" style={{ color: 'rgba(245, 240, 232, 0.15)' }} />
        </div>
      </section>


      {/* ═══════════════════════════════════════════════════════════
          HOW IT WORKS — Cognitive load: exactly 3 steps
          Numbered list format for sequential processing fluency
          ═══════════════════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28 px-6 sm:px-10 bg-background">
        <div className="max-w-2xl mx-auto">
          <h3 className="font-display text-3xl sm:text-4xl text-center mb-14">
            Three steps. That's it.
          </h3>

          <div className="space-y-0">
            {[
              { num: "01", title: "Pick a session", desc: "Choose a café or coworking space, pick a time. We handle the rest.", icon: Coffee },
              { num: "02", title: "Meet your table", desc: "We match you with 3\u20135 compatible people.", icon: UserPlus },
              { num: "03", title: "Focus together", desc: "Work side by side. No small talk required.", icon: Zap },
            ].map((step, i) => (
              <div
                key={step.num}
                className="flex items-start gap-5 sm:gap-6 py-6"
                style={{ borderBottom: i < 2 ? '1px solid hsl(var(--border))' : 'none' }}
              >
                <span
                  className="text-xs font-medium font-body mt-1.5"
                  style={{ color: '#e07830' }}
                >
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

          {/* CTA repeated — one per viewport */}
          <div className="flex justify-center mt-12">
            <CTAButton />
          </div>
        </div>
      </section>


      {/* ═══════════════════════════════════════════════════════════
          WHY DANADONE — Features + trust signals
          Loss-framed section header reinforces emotional hook
          ═══════════════════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28 px-6 sm:px-10" style={{ background: 'hsl(var(--card))' }}>
        <div className="max-w-2xl mx-auto">
          <h3 className="font-display text-3xl sm:text-4xl text-center mb-3 leading-snug">
            Why work alone when you{' '}
            <br className="hidden sm:block" />
            could work alongside{' '}
            <br className="hidden sm:block" />
            people who get it?
          </h3>
          <p className="text-center text-muted-foreground text-sm mb-14 font-body tracking-widest uppercase">
            work &middot; connect &middot; grow
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: Sparkles,
                title: "Smart Matching",
                desc: "Matched by work style, noise preference, and communication mode.",
              },
              {
                icon: CalendarDays,
                title: "Curated Sessions",
                desc: "At verified cafés and coworking spaces with great WiFi, power, and vibes.",
              },
              {
                icon: Users,
                title: "Real Community",
                desc: "Build your coworking crew. Every session, new connections.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl p-5 sm:p-6 transition-shadow hover:shadow-md"
                style={{ background: 'hsl(var(--background))' }}
              >
                <feature.icon className="w-5 h-5 mb-3" style={{ color: '#e07830' }} />
                <h4 className="font-display text-base mb-2">{feature.title}</h4>
                <p className="text-muted-foreground text-sm leading-relaxed font-body">{feature.desc}</p>
              </div>
            ))}
          </div>

          {/* Trust signals — reduce anxiety, increase conversion */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-12">
            {[
              { icon: Shield, label: "Women-only sessions" },
              { icon: Users, label: "Verified members" },
              { icon: Lock, label: "Private reporting" },
            ].map((trust) => (
              <span
                key={trust.label}
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs text-muted-foreground font-body"
                style={{ border: '1px solid hsl(var(--border))' }}
              >
                <trust.icon className="w-3.5 h-3.5" />
                {trust.label}
              </span>
            ))}
          </div>
        </div>
      </section>


      {/* ═══════════════════════════════════════════════════════════
          VENUE PARTNERS — Targets café/coworking owners
          Positioned before final CTA to capture a secondary audience
          ═══════════════════════════════════════════════════════════ */}
      <section
        className="py-20 sm:py-28 px-6 sm:px-10"
        style={{
          background: 'radial-gradient(ellipse at 30% 80%, rgba(210, 120, 50, 0.06) 0%, transparent 60%), linear-gradient(175deg, #1a1410 0%, #1e1814 100%)',
        }}
      >
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Store className="w-5 h-5" style={{ color: '#e07830' }} />
          </div>
          <h3
            className="font-display text-3xl sm:text-4xl text-center mb-4 leading-snug"
            style={{ color: '#f5f0e8' }}
          >
            Own a café or coworking space?
          </h3>
          <p
            className="text-center text-sm sm:text-base mb-14 font-body max-w-md mx-auto leading-relaxed"
            style={{ color: 'rgba(245, 240, 232, 0.45)' }}
          >
            Turn empty seats into a community hub. We send focused professionals to your door — you keep doing what you do best.
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: Clock,
                title: "Fill off-peak hours",
                desc: "We match professionals to your quieter slots. More covers, zero marketing spend.",
              },
              {
                icon: CheckCircle,
                title: "Zero setup required",
                desc: "We handle matching, check-ins, and payments. You just welcome great people.",
              },
              {
                icon: Star,
                title: "Community-powered quality",
                desc: "Members rate every session. Top-rated venues get more bookings automatically.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl p-5 sm:p-6 transition-shadow hover:shadow-md"
                style={{
                  background: 'rgba(245, 240, 232, 0.04)',
                  border: '1px solid rgba(245, 240, 232, 0.06)',
                }}
              >
                <item.icon className="w-5 h-5 mb-3" style={{ color: '#e07830' }} />
                <h4 className="font-display text-base mb-2" style={{ color: '#f5f0e8' }}>
                  {item.title}
                </h4>
                <p className="text-sm leading-relaxed font-body" style={{ color: 'rgba(245, 240, 232, 0.4)' }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="flex justify-center mt-12">
            <button
              onClick={() => navigate("/partners")}
              className="group inline-flex items-center gap-2 rounded-full px-6 py-3.5 sm:px-8 sm:py-4 text-sm sm:text-base font-medium font-body transition-all duration-300 hover:-translate-y-0.5"
              style={{
                background: 'transparent',
                color: '#e8a06a',
                border: '1px solid rgba(224, 120, 48, 0.35)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(224, 120, 48, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(224, 120, 48, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'rgba(224, 120, 48, 0.35)';
              }}
            >
              List your venue
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </section>


      {/* ═══════════════════════════════════════════════════════════
          FINAL CTA — Dark bookend, urgency copy, stats
          "Your table is waiting" creates urgency without being pushy
          ═══════════════════════════════════════════════════════════ */}
      <section
        className="py-20 sm:py-28 px-6 sm:px-10 text-center"
        style={{ background: 'linear-gradient(to bottom, #1a1410, #1e1814)' }}
      >
        <h3
          className="font-display text-3xl sm:text-4xl mb-4"
          style={{ color: '#f5f0e8' }}
        >
          Your table is waiting.
        </h3>
        <p className="font-body text-sm mb-8" style={{ color: 'rgba(245, 240, 232, 0.4)' }}>
          Free to join. No credit card needed.
        </p>

        <CTAButton />

        {/* Community stats — social proof reinforcement */}
        {(stats.members > 0 || stats.sessions > 0 || stats.props > 0) && (
          <div
            className="flex items-center justify-center gap-8 mt-12 font-body"
            style={{ color: 'rgba(245, 240, 232, 0.25)' }}
          >
            {stats.members > 0 && (
              <div className="text-center">
                <span className="block text-lg font-semibold" style={{ color: '#f5f0e8' }}>{stats.members}+</span>
                <span className="text-xs">members</span>
              </div>
            )}
            {stats.sessions > 0 && (
              <div className="text-center">
                <span className="block text-lg font-semibold" style={{ color: '#f5f0e8' }}>{stats.sessions}+</span>
                <span className="text-xs">sessions</span>
              </div>
            )}
            {stats.props > 0 && (
              <div className="text-center">
                <span className="block text-lg font-semibold" style={{ color: '#f5f0e8' }}>{stats.props}+</span>
                <span className="text-xs">props given</span>
              </div>
            )}
          </div>
        )}
      </section>


      {/* Footer */}
      <footer className="py-8 px-6 text-center" style={{ background: '#1a1410' }}>
        <p className="font-display text-lg mb-3" style={{ color: 'rgba(245, 240, 232, 0.25)' }}>
          <span style={{ fontWeight: 300 }}>Dana</span>
          <span className="font-bold">Done</span>
        </p>
        <div className="flex items-center justify-center gap-4 text-xs font-body" style={{ color: 'rgba(245, 240, 232, 0.15)' }}>
          <a href="/partners" className="hover:opacity-60 transition-opacity">Partner Venues</a>
          <span>·</span>
          <span>Built with coffee in Bangalore</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
