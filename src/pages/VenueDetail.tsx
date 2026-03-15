/**
 * Venue Detail page — the destination for everything venue-related.
 *
 * Shows: hero photo, ratings, upcoming sessions, photo gallery, QR code,
 * data completeness, recent check-ins, and reviews.
 *
 * Data sources:
 * - locations table (basic info, coordinates, type)
 * - venue_vibes (crowdsourced ratings aggregated)
 * - events (upcoming sessions at this venue)
 * - check_ins (who's here now)
 * - venue_contributions (photos, data)
 * - venue_reviews (star ratings, via venue_partner_id)
 */
import { useState, useEffect, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VenueIntelligencePanel } from "@/components/venue/VenueQuickBadges";
import { PhotoLightbox } from "@/components/ui/PhotoLightbox";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import {
  ArrowLeft, MapPin, CalendarIcon, Users, Camera,
  QrCode, Star, Clock, Navigation, ChevronRight, Plus,
} from "lucide-react";

import { VenueDataCollector } from "@/components/venue/VenueDataCollector";
import { getVenueDataCompleteness, type VenueCompleteness } from "@/lib/venueContributions";

const VenueQrSection = lazy(() =>
  import("@/components/venue/VenueQrSection").then(m => ({ default: m.VenueQrSection }))
);

// ─── Types ──────────────────────────────────

interface Location {
  id: string;
  name: string;
  location_type: string;
  latitude: number;
  longitude: number;
  neighborhood: string | null;
  city: string;
  is_partner: boolean;
  venue_partner_id: string | null;
  photo_url: string | null;
  verified: boolean;
}

interface UpcomingSession {
  id: string;
  title: string;
  date: string;
  start_time: string | null;
  going: number;
  max_spots: number | null;
}

interface CheckIn {
  id: string;
  user_id: string;
  status: string;
  checked_in_at: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  full_name: string | null;
}

// ─── Helpers ──────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  cafe: "Cafe",
  coworking_space: "Coworking",
  tech_park: "Tech Park",
  business_district: "Business District",
  campus: "Campus",
  neighborhood: "Neighborhood",
  other: "Workspace",
};

function typeLabel(t: string): string {
  return TYPE_LABELS[t] || "Workspace";
}

// ─── Component ──────────────────────────────────

export default function VenueDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  usePageTitle("Venue — DanaDone");

  const [venue, setVenue] = useState<Location | null>(null);
  const [sessions, setSessions] = useState<UpcomingSession[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [dataCollectorOpen, setDataCollectorOpen] = useState(false);
  const [completeness, setCompleteness] = useState<VenueCompleteness | null>(null);

  useEffect(() => {
    if (!id) return;
    loadVenue(id);
    getVenueDataCompleteness(id).then(setCompleteness);
  }, [id]);

  async function loadVenue(venueId: string) {
    setLoading(true);

    // Fetch location
    const { data: loc } = await supabase
      .from("locations")
      .select("id, name, location_type, latitude, longitude, neighborhood, city, is_partner, venue_partner_id, photo_url, verified")
      .eq("id", venueId)
      .single();

    if (!loc) {
      setLoading(false);
      return;
    }

    setVenue(loc as Location);

    // Fetch all related data in parallel
    const today = new Date().toISOString().split("T")[0];

    const [sessionsRes, rsvpsRes, checkInsRes, contributionsRes, reviewsRes] = await Promise.all([
      // Upcoming sessions at this venue (by name match)
      supabase.from("events")
        .select("id, title, date, start_time, max_spots")
        .eq("venue_name", loc.name)
        .gte("date", today)
        .order("date", { ascending: true })
        .limit(5),

      // RSVP counts for sessions
      supabase.from("event_rsvps")
        .select("event_id, status"),

      // Active check-ins at this location
      supabase.from("check_ins")
        .select("id, user_id, status, checked_in_at")
        .eq("location_id", venueId)
        .is("checked_out_at", null)
        .order("checked_in_at", { ascending: false })
        .limit(10),

      // Photo contributions
      supabase.from("venue_contributions")
        .select("data")
        .eq("venue_id", venueId)
        .eq("contribution_type", "photo"),

      // Reviews (if partner venue)
      loc.venue_partner_id
        ? supabase.from("venue_reviews")
            .select("id, rating, comment, created_at, user_id")
            .eq("venue_partner_id", loc.venue_partner_id)
            .order("created_at", { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [] }),
    ]);

    // Process sessions with RSVP counts
    const rsvpCounts: Record<string, number> = {};
    (rsvpsRes.data || []).forEach((r: any) => {
      if (r.status === "going") rsvpCounts[r.event_id] = (rsvpCounts[r.event_id] || 0) + 1;
    });

    setSessions((sessionsRes.data || []).map((e: any) => ({
      id: e.id,
      title: e.title,
      date: e.date,
      start_time: e.start_time,
      max_spots: e.max_spots,
      going: rsvpCounts[e.id] || 0,
    })));

    // Process check-ins — fetch profile names
    const checkInData = checkInsRes.data || [];
    if (checkInData.length > 0) {
      const userIds = [...new Set(checkInData.map((c: any) => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      setCheckIns(checkInData.map((c: any) => {
        const p = profileMap.get(c.user_id);
        return {
          ...c,
          full_name: p?.full_name || "Anonymous",
          avatar_url: p?.avatar_url || null,
        };
      }));
    }

    // Process photos from contributions
    const photoUrls: string[] = [];
    if (loc.photo_url) photoUrls.push(loc.photo_url);
    (contributionsRes.data || []).forEach((c: any) => {
      if (c.data?.photo_url) photoUrls.push(c.data.photo_url);
    });
    setPhotos(photoUrls);

    // Process reviews
    const reviewData = reviewsRes.data || [];
    if (reviewData.length > 0) {
      const userIds = [...new Set(reviewData.map((r: any) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      setReviews(reviewData.map((r: any) => ({
        ...r,
        full_name: profileMap.get(r.user_id)?.full_name || "Anonymous",
      })));

      // Calculate average rating
      const ratings = reviewData.map((r: any) => r.rating).filter(Boolean);
      if (ratings.length > 0) {
        setAvgRating(Math.round(ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length * 10) / 10);
        setReviewCount(ratings.length);
      }
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <AppShell>
        <div className="p-4 space-y-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        </div>
      </AppShell>
    );
  }

  if (!venue) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <MapPin className="w-12 h-12 text-muted-foreground" />
          <p className="text-muted-foreground">Venue not found</p>
          <Button variant="outline" onClick={() => navigate("/map")}>Back to Map</Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="pb-24">
        {/* Back button + rating */}
        <div className="flex items-center justify-between px-4 py-2">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          {avgRating && (
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <span className="text-sm font-semibold">{avgRating}</span>
              <span className="text-xs text-muted-foreground">({reviewCount})</span>
            </div>
          )}
        </div>

        {/* Hero photo or placeholder */}
        {photos.length > 0 ? (
          <button
            onClick={() => setLightboxIndex(0)}
            className="w-full h-48 relative overflow-hidden"
          >
            <img
              src={photos[0]}
              alt={venue.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {photos.length > 1 && (
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                +{photos.length - 1} photos
              </div>
            )}
          </button>
        ) : (
          <div className="w-full h-32 bg-muted flex items-center justify-center">
            <div className="text-center space-y-1">
              <Camera className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-xs text-muted-foreground">No photos yet</p>
            </div>
          </div>
        )}

        {/* Venue name and info */}
        <div className="px-4 pt-4 space-y-1">
          <h1 className="font-serif text-xl text-foreground">{venue.name}</h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3" />
            <span>{venue.neighborhood || venue.city}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {typeLabel(venue.location_type)}
            </Badge>
            {venue.is_partner && (
              <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">
                Partner Venue
              </Badge>
            )}
            {venue.verified && (
              <Badge className="text-[10px] bg-green-500/10 text-green-600 border-green-500/20">
                Verified
              </Badge>
            )}
          </div>
        </div>

        {/* Venue Intelligence (ratings) */}
        <div className="px-4 pt-4">
          <VenueIntelligencePanel venueName={venue.name} hasAttended={false} />
        </div>

        {/* Active check-ins */}
        {checkIns.length > 0 && (
          <div className="px-4 pt-4">
            <Card className="border-green-500/20 bg-green-500/5">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-medium text-foreground">
                    {checkIns.length} {checkIns.length === 1 ? "person" : "people"} here now
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {checkIns.slice(0, 5).map((c) => (
                    <span key={c.id} className="text-[10px] text-muted-foreground bg-background rounded-full px-2 py-0.5 border border-border">
                      {c.full_name?.split(" ")[0] || "Someone"} · {c.status === "deep_work" ? "Focused" : "Available"}
                    </span>
                  ))}
                  {checkIns.length > 5 && (
                    <span className="text-[10px] text-muted-foreground">+{checkIns.length - 5} more</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Upcoming sessions */}
        {sessions.length > 0 && (
          <div className="px-4 pt-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Upcoming Sessions</p>
            {sessions.map((s) => (
              <Card
                key={s.id}
                className="cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => navigate(`/events/${s.id}`)}
              >
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CalendarIcon className="w-3 h-3 shrink-0" />
                      <span>{format(parseISO(s.date), "EEE, MMM d")}{s.start_time ? ` · ${s.start_time}` : ""}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      <Users className="w-3 h-3 inline mr-0.5" />
                      {s.going}{s.max_spots ? `/${s.max_spots}` : ""}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Photo gallery */}
        {photos.length > 0 && (
          <div className="px-4 pt-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Photos ({photos.length})
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {photos.slice(0, 6).map((url, i) => (
                <button
                  key={i}
                  onClick={() => setLightboxIndex(i)}
                  className="aspect-square rounded-lg overflow-hidden"
                >
                  <img src={url} alt={`${venue.name} photo ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
              {photos.length > 6 && (
                <button
                  onClick={() => setLightboxIndex(6)}
                  className="aspect-square rounded-lg bg-muted flex items-center justify-center"
                >
                  <span className="text-sm font-medium text-muted-foreground">+{photos.length - 6}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* QR Code */}
        <div className="px-4 pt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">QR Code</p>
          <Suspense fallback={<Skeleton className="h-32 rounded-xl" />}>
            <VenueQrSection venueId={venue.id} venueName={venue.name} />
          </Suspense>
        </div>

        {/* Reviews */}
        {reviews.length > 0 && (
          <div className="px-4 pt-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reviews</p>
            {reviews.slice(0, 5).map((r) => (
              <Card key={r.id}>
                <CardContent className="p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">{r.full_name}</span>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star
                          key={s}
                          className={`w-3 h-3 ${s <= r.rating ? "text-yellow-500 fill-yellow-500" : "text-muted"}`}
                        />
                      ))}
                    </div>
                  </div>
                  {r.comment && (
                    <p className="text-xs text-muted-foreground">{r.comment}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    {format(parseISO(r.created_at), "MMM d, yyyy")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Contribute CTA — opens data collector sheet */}
        <div className="px-4 pt-4">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 text-center space-y-2">
              <Camera className="w-6 h-6 text-primary mx-auto" />
              <p className="text-sm font-medium text-foreground">Help make this page richer</p>
              <p className="text-xs text-muted-foreground">
                {completeness && completeness.overallPercent < 100
                  ? `${completeness.overallPercent}% complete — be first to add missing data for 2x FC`
                  : "Add photos, rate the venue, or share details to earn FC"}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDataCollectorOpen(true)}
                className="text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                Contribute data
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Data collection sheet */}
        {user && venue && (
          <VenueDataCollector
            open={dataCollectorOpen}
            onOpenChange={setDataCollectorOpen}
            venueId={venue.id}
            venueName={venue.name}
            userId={user.id}
            completeness={completeness}
            onContributed={() => {
              getVenueDataCompleteness(venue.id).then(setCompleteness);
            }}
          />
        )}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <PhotoLightbox
          images={photos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          alt={`${venue.name} photo`}
        />
      )}
    </AppShell>
  );
}
