import { MapPin, Sparkles, MessageCircle, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { usePageTitle } from "@/hooks/usePageTitle";
import { ERROR_STATES } from "@/lib/personality";

const features = [
  {
    icon: Sparkles,
    title: "Smart Matching",
    description: "Get matched with people who work like you",
  },
  {
    icon: MessageCircle,
    title: "Weekly Prompts",
    description: "Build your profile one question at a time",
  },
  {
    icon: CalendarDays,
    title: "Cowork Sessions",
    description: "Cowork together at curated sessions",
  },
];

const Index = () => {
  usePageTitle("FocusClub — Find your people. Focus together.");
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [signingIn, setSigningIn] = useState(false);
  const [referrer, setReferrer] = useState<{ display_name: string | null; avatar_url: string | null } | null>(null);
  const [venueInfo, setVenueInfo] = useState<{ venue_name: string; neighborhood: string | null } | null>(null);

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
      // Track scan
      supabase.from("venue_scans").insert({ venue_partner_id: venueId });
      // Fetch venue info
      supabase.from("venue_partners").select("venue_name, neighborhood").eq("id", venueId).single()
        .then(({ data }: any) => { if (data) setVenueInfo(data); });
    }
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      if (profile?.onboarding_completed) {
        navigate("/home");
      } else {
        navigate("/onboarding");
      }
    }
  }, [user, profile, loading, navigate]);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <h1 className="text-4xl tracking-tight animate-pulse">
          <span className="font-serif">Focus</span>
          <span className="font-sans font-light">Club</span>
        </h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-10">
        {/* Logo */}
        <div className="mb-8">
          <h1 className="text-4xl tracking-tight">
            <span className="font-serif">Focus</span>
            <span className="font-sans font-light">Club</span>
          </h1>
        </div>

        {/* Tagline */}
        <h2 className="font-serif text-3xl sm:text-4xl text-center leading-tight mb-4 animate-fade-up">
          Where strangers become<br />coworkers become friends.
        </h2>

        <p className="text-muted-foreground text-center max-w-md mb-6 text-base leading-relaxed animate-fade-up" style={{ animationDelay: "0.1s" }}>
          {venueInfo
            ? `Join the community of people who cowork at ${venueInfo.venue_name} and other great spots in Bangalore.`
            : "We match you with 3-5 people at great cafes. You focus. You connect. You come back."}
        </p>

        {venueInfo && (
          <div className="flex items-center gap-2 mb-4 bg-primary/10 rounded-full px-4 py-2 animate-fade-up" style={{ animationDelay: "0.15s" }}>
            <MapPin className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">{venueInfo.venue_name} is a FocusClub partner! 🎯</span>
          </div>
        )}

        {/* Google Sign In */}
        <Button 
          variant="google" 
          size="lg" 
          className="rounded-full px-8 mb-16 animate-fade-up" 
          style={{ animationDelay: "0.2s" }}
          onClick={handleGoogleSignIn}
          disabled={signingIn}
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {signingIn ? "One sec..." : "Join the club"}
        </Button>

        {/* Invited by */}
        {referrer && (
          <div className="flex items-center gap-2 mb-8 animate-fade-up" style={{ animationDelay: "0.15s" }}>
            <Avatar className="w-8 h-8">
              <AvatarImage src={referrer.avatar_url || ""} />
              <AvatarFallback className="text-xs bg-muted">{getInitials(referrer.display_name)}</AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">Invited by <span className="font-medium text-foreground">{referrer.display_name}</span></span>
          </div>
        )}
        {/* Feature Cards */}
        <div className="w-full max-w-md space-y-4">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className="bg-card rounded-lg p-5 shadow-sm flex items-start gap-4 animate-fade-up"
              style={{ animationDelay: `${0.3 + i * 0.1}s` }}
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-serif text-lg mb-0.5">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Social Proof */}
        <div className="mt-14 flex items-center gap-2 text-muted-foreground text-sm animate-fade-up" style={{ animationDelay: "0.6s" }}>
          <MapPin className="w-4 h-4 text-secondary" />
          <span>Starting in HSR Layout, Bangalore</span>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center space-y-2">
        <a href="/partners" className="text-sm text-primary hover:underline">Our Partner Venues</a>
        <p className="text-muted-foreground text-sm">Built with ☕ in Bangalore</p>
      </footer>
    </div>
  );
};

export default Index;
