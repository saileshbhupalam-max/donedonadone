/**
 * @page NominateVenue
 * @route /nominate
 * @description Permissionless venue nomination page. Three views:
 *
 * 1. **List** — Shows all nominations in the user's neighborhood with vouch counts.
 *    Own nominations show "Your nomination" badge. Others show "Vouch" button.
 * 2. **Nominate** — Form to submit a new venue (name, address, Maps link, WiFi toggle).
 *    Awards 30 FC. Requires neighborhood to be unlocked (10+ members).
 * 3. **Vouch** — Confirm a nominated venue is legit (WiFi, power, seating, noise).
 *    Awards 3 FC. If this is the 3rd vouch, venue auto-activates.
 *
 * Guards: Redirects to Settings if no neighborhood set. Shows unlock progress
 * if neighborhood is locked. Normalizes neighborhood via normalizeNeighborhood().
 *
 * Dependencies: venueNomination.ts (all logic), neighborhoods.ts (normalization)
 * Tables read: venue_nominations, venue_vouches, neighborhood_stats, profiles
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import { toast } from "sonner";
import {
  MapPin, CheckCircle2, Loader2, ArrowLeft, ThumbsUp, Wifi,
  Plug, Armchair, Volume2, Camera, Plus, ShieldCheck,
} from "lucide-react";
import { motion } from "framer-motion";
import { getInitials } from "@/lib/utils";
import {
  nominateVenue,
  vouchForVenue,
  getNominations,
  getNeighborhoodReadiness,
  getVouchesForNomination,
  type Nomination,
  type VouchData,
  type NeighborhoodReadiness,
} from "@/lib/venueNomination";
import { normalizeNeighborhood } from "@/lib/neighborhoods";

type View = "list" | "nominate" | "vouch";

export default function NominateVenue() {
  usePageTitle("Nominate a Venue — FocusClub");
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [userNeighborhood, setUserNeighborhood] = useState("");
  const [readiness, setReadiness] = useState<NeighborhoodReadiness | null>(null);
  const [view, setView] = useState<View>("list");
  const [submitting, setSubmitting] = useState(false);

  // Nomination form
  const [form, setForm] = useState({
    venue_name: "",
    address: "",
    google_maps_url: "",
    wifi_available: true,
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Vouch state
  const [selectedNomination, setSelectedNomination] = useState<Nomination | null>(null);
  const [vouches, setVouches] = useState<any[]>([]);
  const [vouchForm, setVouchForm] = useState<VouchData>({
    wifi_works: true,
    has_power_outlets: true,
    has_adequate_seating: true,
    noise_level: "moderate",
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("neighborhood")
        .eq("id", user.id)
        .single();

      const rawNeighborhood = profile?.neighborhood || "";
      const neighborhood = rawNeighborhood ? normalizeNeighborhood(rawNeighborhood) : "";
      setUserNeighborhood(neighborhood);

      if (neighborhood) {
        const r = await getNeighborhoodReadiness(neighborhood);
        setReadiness(r);
      }
      setLoading(false);
    })();
  }, [user]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be under 5MB");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const uploadPhoto = async (): Promise<string | undefined> => {
    if (!photoFile || !user) return undefined;
    setUploading(true);
    const ext = photoFile.name.split(".").pop() || "jpg";
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("venue-photos").upload(path, photoFile);
    setUploading(false);
    if (error) {
      toast.error("Photo upload failed");
      return undefined;
    }
    const { data } = supabase.storage.from("venue-photos").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleNominate = async () => {
    if (!user || !form.venue_name || !form.address) {
      toast.error("Venue name and address are required");
      return;
    }
    setSubmitting(true);

    // Upload photo first if selected
    const photo_url = await uploadPhoto();

    const result = await nominateVenue(user.id, {
      venue_name: form.venue_name,
      address: form.address,
      neighborhood: userNeighborhood,
      google_maps_url: form.google_maps_url || undefined,
      wifi_available: form.wifi_available,
      photo_url,
    });

    if (result.success) {
      toast.success(`Venue nominated! +${result.creditsAwarded} FC`);
      setForm({ venue_name: "", address: "", google_maps_url: "", wifi_available: true });
      setPhotoFile(null);
      setPhotoPreview(null);
      setView("list");
      // Refresh nominations
      const r = await getNeighborhoodReadiness(userNeighborhood);
      setReadiness(r);
    } else {
      toast.error(result.error || "Failed to nominate");
    }
    setSubmitting(false);
  };

  const openVouch = async (nomination: Nomination) => {
    setSelectedNomination(nomination);
    const v = await getVouchesForNomination(nomination.id);
    setVouches(v);
    setView("vouch");
  };

  const handleVouch = async () => {
    if (!user || !selectedNomination) return;
    setSubmitting(true);
    const result = await vouchForVenue(user.id, selectedNomination.id, vouchForm);

    if (result.success) {
      if (result.activated) {
        toast.success("Venue verified and activated! This venue is now live.");
      } else {
        toast.success(`Vouch recorded! +${result.creditsAwarded} FC`);
      }
      setView("list");
      const r = await getNeighborhoodReadiness(userNeighborhood);
      setReadiness(r);
    } else {
      toast.error(result.error || "Failed to vouch");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <AppShell>
        <div className="px-4 py-4 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </AppShell>
    );
  }

  if (!userNeighborhood) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-4">
          <MapPin className="w-12 h-12 text-muted-foreground" />
          <h1 className="font-serif text-2xl">Set your neighborhood first</h1>
          <p className="text-sm text-muted-foreground max-w-sm">
            Update your profile with your neighborhood to nominate venues in your area.
          </p>
          <Button onClick={() => navigate("/settings")}>Go to Settings</Button>
        </div>
      </AppShell>
    );
  }

  if (readiness && !readiness.isUnlocked) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-4">
          <MapPin className="w-12 h-12 text-primary" />
          <h1 className="font-serif text-2xl">{userNeighborhood} is almost unlocked!</h1>
          <p className="text-sm text-muted-foreground max-w-sm">
            {readiness.memberCount}/{readiness.threshold} members in your area.
            Invite {readiness.threshold - readiness.memberCount} more to unlock venue nominations.
          </p>
          <Button variant="outline" onClick={() => navigate("/home")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Home
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-4 py-4 space-y-4 max-w-lg mx-auto pb-8"
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => {
            if (view !== "list") setView("list");
            else navigate(-1);
          }}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-serif text-2xl text-foreground">
              {view === "nominate" ? "Nominate a Venue" : view === "vouch" ? "Vouch for Venue" : "Venues in " + userNeighborhood}
            </h1>
            <p className="text-xs text-muted-foreground">
              {view === "list" && `${readiness?.nominations.length || 0} nominations · ${readiness?.activeVenues || 0} active`}
              {view === "nominate" && "Know a great work spot? Share it with the community."}
              {view === "vouch" && "Confirm this venue is legit to help it go live."}
            </p>
          </div>
        </div>

        {/* ─── LIST VIEW ─── */}
        {view === "list" && (
          <>
            <Button className="w-full" onClick={() => setView("nominate")}>
              <Plus className="w-4 h-4 mr-2" /> Nominate a New Venue
            </Button>

            {(!readiness?.nominations || readiness.nominations.length === 0) ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No nominations yet. Be the first to nominate your favorite work spot!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {readiness!.nominations.map((nom) => {
                  const isOwn = nom.nominated_by === user?.id;
                  const isVerified = nom.status === "verified" || nom.status === "active";
                  return (
                    <Card key={nom.id} className={isVerified ? "border-green-500/30" : ""}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground truncate">{nom.venue_name}</p>
                              {isVerified && (
                                <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-600 shrink-0">
                                  <ShieldCheck className="w-3 h-3 mr-0.5" /> Verified
                                </Badge>
                              )}
                            </div>
                            {nom.address && (
                              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{nom.address}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              <div className="flex items-center gap-1">
                                <Avatar className="w-4 h-4">
                                  <AvatarImage src={nom.nominator_avatar || ""} />
                                  <AvatarFallback className="text-[7px]">{getInitials(nom.nominator_name || "")}</AvatarFallback>
                                </Avatar>
                                <span className="text-[10px] text-muted-foreground">{nom.nominator_name}</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground">
                                {nom.vouch_count}/3 vouches
                              </span>
                              {nom.wifi_available && (
                                <Wifi className="w-3 h-3 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                          {!isOwn && !isVerified && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="shrink-0 text-xs"
                              onClick={() => openVouch(nom)}
                            >
                              <ThumbsUp className="w-3 h-3 mr-1" /> Vouch
                            </Button>
                          )}
                          {isOwn && (
                            <Badge variant="secondary" className="text-[10px] shrink-0">Your nomination</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ─── NOMINATE VIEW ─── */}
        {view === "nominate" && (
          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <Label>Venue Name *</Label>
                <Input
                  value={form.venue_name}
                  onChange={(e) => setForm({ ...form, venue_name: e.target.value })}
                  placeholder="e.g., Third Wave Coffee"
                />
              </div>
              <div>
                <Label>Address *</Label>
                <Input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Full address"
                />
              </div>
              <div>
                <Label>Google Maps Link</Label>
                <Input
                  value={form.google_maps_url}
                  onChange={(e) => setForm({ ...form, google_maps_url: e.target.value })}
                  placeholder="https://maps.google.com/..."
                />
              </div>
              {/* Photo upload */}
              <div>
                <Label>Venue Photo</Label>
                <div className="mt-1">
                  {photoPreview ? (
                    <div className="relative">
                      <img
                        src={photoPreview}
                        alt="Venue preview"
                        className="w-full h-40 object-cover rounded-lg"
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        className="absolute top-2 right-2 h-7 text-xs"
                        onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 h-24 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                      <Camera className="w-5 h-5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Add a photo (optional)</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoSelect}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label>WiFi Available</Label>
                <Switch
                  checked={form.wifi_available}
                  onCheckedChange={(v) => setForm({ ...form, wifi_available: v })}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                You'll earn 30 FC for nominating. If 3 members vouch and the venue goes live, you earn 30 more!
              </p>
              <Button
                className="w-full"
                disabled={submitting || uploading || !form.venue_name || !form.address}
                onClick={handleNominate}
              >
                {submitting || uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MapPin className="w-4 h-4 mr-2" />}
                {uploading ? "Uploading photo..." : submitting ? "Submitting..." : "Submit Nomination"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ─── VOUCH VIEW ─── */}
        {view === "vouch" && selectedNomination && (
          <>
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium text-foreground">{selectedNomination.venue_name}</h3>
                {selectedNomination.address && (
                  <p className="text-xs text-muted-foreground mt-0.5">{selectedNomination.address}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Nominated by {selectedNomination.nominator_name} · {selectedNomination.vouch_count}/3 vouches
                </p>
              </CardContent>
            </Card>

            {/* Existing vouches */}
            {vouches.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Previous vouches</p>
                {vouches.map((v, i) => (
                  <Card key={i}>
                    <CardContent className="p-3 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      <span className="text-sm text-foreground">{v.display_name}</span>
                      {v.comment && <span className="text-[10px] text-muted-foreground truncate">— {v.comment}</span>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Vouch form */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-xs font-medium text-foreground">Have you been to this venue?</p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">WiFi works</span>
                  </div>
                  <Switch
                    checked={vouchForm.wifi_works ?? true}
                    onCheckedChange={(v) => setVouchForm({ ...vouchForm, wifi_works: v })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Plug className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Power outlets</span>
                  </div>
                  <Switch
                    checked={vouchForm.has_power_outlets ?? true}
                    onCheckedChange={(v) => setVouchForm({ ...vouchForm, has_power_outlets: v })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Armchair className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Adequate seating</span>
                  </div>
                  <Switch
                    checked={vouchForm.has_adequate_seating ?? true}
                    onCheckedChange={(v) => setVouchForm({ ...vouchForm, has_adequate_seating: v })}
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Volume2 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Noise level</span>
                  </div>
                  <div className="flex gap-2">
                    {(["quiet", "moderate", "lively"] as const).map((level) => (
                      <Button
                        key={level}
                        size="sm"
                        variant={vouchForm.noise_level === level ? "default" : "outline"}
                        className="flex-1 text-xs capitalize"
                        onClick={() => setVouchForm({ ...vouchForm, noise_level: level })}
                      >
                        {level}
                      </Button>
                    ))}
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground">
                  You'll earn 3 FC for vouching. If this is the 3rd vouch, the venue goes live!
                </p>

                <Button className="w-full" disabled={submitting} onClick={handleVouch}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ThumbsUp className="w-4 h-4 mr-2" />}
                  Vouch for this Venue
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </motion.div>
    </AppShell>
  );
}
