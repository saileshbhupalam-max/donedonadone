import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, ExternalLink, Instagram, MessageCircle } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";

const NEIGHBORHOODS: Record<string, string> = {
  hsr_layout: "HSR Layout", koramangala: "Koramangala", indiranagar: "Indiranagar",
  jayanagar: "Jayanagar", whitefield: "Whitefield", electronic_city: "Electronic City",
};

export default function Partners() {
  usePageTitle("Partner Venues — FocusClub");
  const [venues, setVenues] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: venueData }, { data: reviewData }] = await Promise.all([
        supabase.from("venue_partners").select("*").eq("status", "active").order("venue_name"),
        supabase.from("venue_reviews").select("venue_partner_id, rating"),
      ]);
      setVenues(venueData || []);
      setReviews(reviewData || []);
      setLoading(false);
    })();
  }, []);

  const getAvgRating = (venueId: string) => {
    const r = reviews.filter((rv: any) => rv.venue_partner_id === venueId);
    if (r.length === 0) return null;
    return (r.reduce((a: number, rv: any) => a + rv.rating, 0) / r.length).toFixed(1);
  };

  return (
    <AppShell>
      <div className="px-4 py-4 space-y-6 max-w-lg mx-auto">
        <div className="text-center space-y-2">
          <h1 className="font-serif text-2xl text-foreground">Our Partner Venues</h1>
          <p className="text-sm text-muted-foreground">Great cafes and coworking spaces where FocusClub sessions happen</p>
        </div>

        {loading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
        ) : venues.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">
            <p className="font-serif text-lg mb-1">Coming soon!</p>
            <p className="text-sm">Partner venues will be listed here.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {venues.map((v: any) => {
              const avg = getAvgRating(v.id);
              return (
                <Card key={v.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-serif text-lg text-foreground">{v.venue_name}</h3>
                        {v.neighborhood && (
                          <Badge variant="outline" className="text-xs mt-1">
                            <MapPin className="w-3 h-3 mr-1" />
                            {NEIGHBORHOODS[v.neighborhood] || v.neighborhood}
                          </Badge>
                        )}
                      </div>
                      {avg && (
                        <div className="text-right">
                          <p className="text-lg font-bold text-foreground">⭐ {avg}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      {(v.events_hosted || 0) > 0 && <span>{v.events_hosted} sessions hosted</span>}
                      {(v.members_acquired || 0) > 0 && <span>{v.members_acquired} members cowork here</span>}
                    </div>

                    <div className="flex gap-2">
                      {v.google_maps_url && (
                        <Button size="sm" variant="outline" className="text-xs" asChild>
                          <a href={v.google_maps_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3 h-3" /> View on Maps
                          </a>
                        </Button>
                      )}
                      {v.instagram_handle && (
                        <Button size="sm" variant="outline" className="text-xs" asChild>
                          <a href={`https://instagram.com/${v.instagram_handle.replace("@", "")}`} target="_blank" rel="noopener noreferrer">
                            <Instagram className="w-3 h-3" /> {v.instagram_handle}
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* CTA */}
        <Card className="border-primary/20">
          <CardContent className="p-6 text-center space-y-3">
            <h3 className="font-serif text-lg text-foreground">Want your venue featured?</h3>
            <p className="text-sm text-muted-foreground">Partner with FocusClub and get focused professionals visiting your space regularly.</p>
            <Button className="gap-2" onClick={() => window.open("https://wa.me/919876543210?text=Hi! I'd like to partner my venue with FocusClub.", "_blank")}>
              <MessageCircle className="w-4 h-4" /> Contact Us
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
