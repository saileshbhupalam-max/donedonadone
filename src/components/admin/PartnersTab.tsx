import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Copy, MessageCircle, Upload, MapPin, QrCode, ExternalLink, BarChart3 } from "lucide-react";
import { format } from "date-fns";

const NEIGHBORHOODS = [
  { value: "hsr_layout", label: "HSR Layout" },
  { value: "koramangala", label: "Koramangala" },
  { value: "indiranagar", label: "Indiranagar" },
  { value: "jayanagar", label: "Jayanagar" },
  { value: "whitefield", label: "Whitefield" },
  { value: "electronic_city", label: "Electronic City" },
];

const STATUSES = ["lead", "contacted", "interested", "active", "declined", "churned"] as const;
const STATUS_COLORS: Record<string, string> = {
  lead: "bg-muted text-muted-foreground",
  contacted: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  interested: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  declined: "bg-destructive/10 text-destructive",
  churned: "bg-muted text-muted-foreground line-through",
};

interface VenuePartner {
  id: string;
  venue_name: string;
  venue_address: string | null;
  neighborhood: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  google_maps_url: string | null;
  instagram_handle: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  notes: string | null;
  partnership_type: string;
  revenue_share_pct: number | null;
  events_hosted: number | null;
  members_acquired: number | null;
  qr_code_url: string | null;
  created_at: string | null;
  updated_at: string | null;
}

const getNeighborhoodLabel = (v: string | null) => NEIGHBORHOODS.find(n => n.value === v)?.label || v || "";
const APP_URL = typeof window !== "undefined" ? window.location.origin : "https://focusclub.app";

function getQrLink(venueId: string) {
  return `${APP_URL}/?venue=${venueId}&utm_source=qr&utm_medium=table_tent`;
}

function getPitchMessage(partner: VenuePartner, adminName = "FocusClub Team") {
  return `Hi ${partner.contact_name || "there"}! 👋

I'm ${adminName} from FocusClub — we organize coworking meetups in ${getNeighborhoodLabel(partner.neighborhood) || "Bangalore"}. We bring groups of 3-5 focused professionals to work at great cafes.

We'd love to feature ${partner.venue_name} as a partner venue. Here's what it means:

✅ We bring 5-15 customers per session (they order food & drinks)
✅ Zero cost to you — we handle everything
✅ Your venue gets featured in our app to 500+ members
✅ We place branded table tents that drive new customers to you

Interested? I can drop by to chat — takes 5 minutes.

Check us out: focusclub.app`;
}

// ─── Dashboard Stats ──────────────────────────────────────
function PartnerDashboardStats({ partners, scansThisMonth, membersThisMonth }: { partners: VenuePartner[]; scansThisMonth: number; membersThisMonth: number }) {
  const byStatus: Record<string, number> = {};
  partners.forEach(p => { byStatus[p.status] = (byStatus[p.status] || 0) + 1; });
  const active = byStatus["active"] || 0;
  const totalScans = partners.reduce((a, p) => a + (p.members_acquired || 0), 0);
  const topVenue = partners.filter(p => p.status === "active").sort((a, b) => (b.members_acquired || 0) - (a.members_acquired || 0))[0];

  return (
    <div className="grid grid-cols-2 gap-3 mb-4">
      {[
        { label: "Total Partners", value: partners.length },
        { label: "Active", value: active },
        { label: "QR Scans (month)", value: scansThisMonth },
        { label: "Members via QR", value: membersThisMonth },
      ].map(s => (
        <Card key={s.label}>
          <CardContent className="p-3">
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
            <p className="text-xl font-bold text-foreground">{s.value}</p>
          </CardContent>
        </Card>
      ))}
      {topVenue && (
        <Card className="col-span-2">
          <CardContent className="p-3 flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Top venue:</span>
            <span className="text-sm font-medium text-foreground">{topVenue.venue_name}</span>
            <span className="text-[11px] text-muted-foreground">({topVenue.members_acquired || 0} members)</span>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── QR Code Card (uses shared component) ──────────────────────────────────────
import { VenueQrSection } from "@/components/venue/VenueQrSection";

// ─── Partner Form ──────────────────────────────────────
function PartnerForm({ partner, onSave, onClose }: { partner?: VenuePartner | null; onSave: () => void; onClose: () => void }) {
  const [form, setForm] = useState({
    venue_name: partner?.venue_name || "",
    venue_address: partner?.venue_address || "",
    neighborhood: partner?.neighborhood || "",
    contact_name: partner?.contact_name || "",
    contact_phone: partner?.contact_phone || "",
    contact_email: partner?.contact_email || "",
    google_maps_url: partner?.google_maps_url || "",
    latitude: partner?.latitude || "",
    longitude: partner?.longitude || "",
    instagram_handle: partner?.instagram_handle || "",
    partnership_type: partner?.partnership_type || "free_hosting",
    revenue_share_pct: partner?.revenue_share_pct || 0,
    notes: partner?.notes || "",
    status: partner?.status || "lead",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.venue_name) return;
    const saveForm = {
      ...form,
      latitude: form.latitude ? Number(form.latitude) : null,
      longitude: form.longitude ? Number(form.longitude) : null,
    };
    setSaving(true);
    try {
      if (partner?.id) {
        const { error } = await supabase.from("venue_partners").update(saveForm).eq("id", partner.id);
        if (error) throw error;
        toast.success("Partner updated!");
      } else {
        const { error } = await supabase.from("venue_partners").insert(saveForm);
        if (error) throw error;
        toast.success("Partner added!");
      }
      onSave();
      onClose();
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to save partner");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div><Label>Venue Name *</Label><Input value={form.venue_name} onChange={e => setForm(f => ({ ...f, venue_name: e.target.value }))} /></div>
      <div><Label>Address</Label><Input value={form.venue_address} onChange={e => setForm(f => ({ ...f, venue_address: e.target.value }))} /></div>
      <div>
        <Label>Neighborhood</Label>
        <Select value={form.neighborhood} onValueChange={v => setForm(f => ({ ...f, neighborhood: v }))}>
          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent>{NEIGHBORHOODS.map(n => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Contact Name</Label><Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} /></div>
        <div><Label>Phone</Label><Input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} /></div>
      </div>
      <div><Label>Email</Label><Input value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} /></div>
      <div><Label>Google Maps URL</Label><Input value={form.google_maps_url} onChange={e => setForm(f => ({ ...f, google_maps_url: e.target.value }))} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Latitude</Label>
          <Input type="number" step="any" placeholder="12.9141" value={form.latitude || ''} 
            onChange={e => setForm(f => ({...f, latitude: parseFloat(e.target.value) || ''}))} />
        </div>
        <div>
          <Label>Longitude</Label>
          <Input type="number" step="any" placeholder="77.6389" value={form.longitude || ''} 
            onChange={e => setForm(f => ({...f, longitude: parseFloat(e.target.value) || ''}))} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Get coordinates from Google Maps (right-click then coordinates)</p>
      <div><Label>Instagram Handle</Label><Input value={form.instagram_handle} onChange={e => setForm(f => ({ ...f, instagram_handle: e.target.value }))} placeholder="@cafename" /></div>
      <div>
        <Label>Partnership Type</Label>
        <Select value={form.partnership_type} onValueChange={v => setForm(f => ({ ...f, partnership_type: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="free_hosting">Free Hosting</SelectItem>
            <SelectItem value="revenue_share">Revenue Share</SelectItem>
            <SelectItem value="sponsored">Sponsored</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {form.partnership_type === "revenue_share" && (
        <div><Label>Revenue Share %</Label><Input type="number" value={form.revenue_share_pct} onChange={e => setForm(f => ({ ...f, revenue_share_pct: parseInt(e.target.value) || 0 }))} /></div>
      )}
      {partner?.id && (
        <div>
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} /></div>
      <Button className="w-full" onClick={handleSave} disabled={!form.venue_name || saving}>{saving ? "Saving..." : partner?.id ? "Update Partner" : "Add Partner"}</Button>
    </div>
  );
}

// ─── Partner Detail ──────────────────────────────────────
function PartnerDetail({ partner, onBack, onRefresh }: { partner: VenuePartner; onBack: () => void; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("venue_reviews").select("*").eq("venue_partner_id", partner.id).then(({ data }) => setReviews(data || []));
  }, [partner.id]);

  const avgRating = reviews.length ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1) : null;

  const pitchMsg = getPitchMessage(partner);
  const phone = partner.contact_phone?.replace(/\D/g, "");

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">← Back to pipeline</button>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl text-foreground">{partner.venue_name}</h2>
          <p className="text-sm text-muted-foreground">{getNeighborhoodLabel(partner.neighborhood)} · {partner.partnership_type.replace("_", " ")}</p>
        </div>
        <Badge className={STATUS_COLORS[partner.status]}>{partner.status}</Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card><CardContent className="p-3 text-center">
          <p className="text-lg font-bold text-foreground">{partner.members_acquired || 0}</p>
          <p className="text-[10px] text-muted-foreground">Members via QR</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-lg font-bold text-foreground">{partner.events_hosted || 0}</p>
          <p className="text-[10px] text-muted-foreground">Sessions Hosted</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-lg font-bold text-foreground">{avgRating || "—"}</p>
          <p className="text-[10px] text-muted-foreground">Avg Rating</p>
        </CardContent></Card>
      </div>

      {/* QR Code */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-medium text-foreground mb-3">QR Code</h3>
          <VenueQrSection venueId={partner.id} venueName={partner.venue_name} />
        </CardContent>
      </Card>

      {/* Contact & Outreach */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-medium text-foreground">Contact</h3>
          {partner.contact_name && <p className="text-sm text-foreground">{partner.contact_name}</p>}
          {partner.contact_phone && <p className="text-sm text-muted-foreground">{partner.contact_phone}</p>}
          {partner.contact_email && <p className="text-sm text-muted-foreground">{partner.contact_email}</p>}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="text-xs flex-1" onClick={() => { navigator.clipboard.writeText(pitchMsg); toast.success("Pitch copied!"); }}>
              <Copy className="w-3 h-3" /> Copy Pitch
            </Button>
            {phone && (
              <Button size="sm" className="text-xs flex-1 bg-[#25D366] hover:bg-[#20BD5A] text-white"
                onClick={() => window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(pitchMsg)}`, "_blank")}>
                <MessageCircle className="w-3 h-3" /> WhatsApp
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit */}
      <Button variant="outline" className="w-full" onClick={() => setEditing(true)}>Edit Partner Details</Button>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif">Edit Partner</DialogTitle></DialogHeader>
          <PartnerForm partner={partner} onSave={onRefresh} onClose={() => setEditing(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── CSV Import ──────────────────────────────────────
function CsvImport({ onDone }: { onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split("\n").filter(l => l.trim());
    if (lines.length < 2) { toast.error("CSV must have header + data rows"); return; }

    const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
    const rows = lines.slice(1).map(line => {
      const values = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = values[i] || null; });
      return obj;
    });

    let imported = 0;
    for (const row of rows) {
      if (!row.venue_name) continue;
      const { error } = await supabase.from("venue_partners").insert({
        venue_name: row.venue_name,
        venue_address: row.address || row.venue_address || null,
        neighborhood: row.neighborhood || null,
        contact_name: row.contact_name || null,
        contact_phone: row.contact_phone || null,
        contact_email: row.contact_email || null,
        google_maps_url: row.google_maps_url || null,
        status: "lead",
      });
      if (!error) imported++;
    }
    toast.success(`Imported ${imported} new leads`);
    onDone();
  };

  return (
    <>
      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
      <Button size="sm" variant="outline" className="text-xs" onClick={() => fileRef.current?.click()}>
        <Upload className="w-3 h-3" /> Import CSV
      </Button>
    </>
  );
}

// ─── Main Partners Tab ──────────────────────────────────
export function PartnersTab() {
  const [partners, setPartners] = useState<VenuePartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<VenuePartner | null>(null);
  const [scansThisMonth, setScansThisMonth] = useState(0);
  const [membersThisMonth, setMembersThisMonth] = useState(0);

  const fetchPartners = async () => {
    const { data } = await supabase.from("venue_partners").select("*").order("created_at", { ascending: false });
    setPartners(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchPartners();
    // Fetch monthly scan stats
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    supabase.from("venue_scans").select("id, resulted_in_signup", { count: "exact" })
      .gte("scanned_at", monthStart.toISOString())
      .then(({ data, count }) => {
        setScansThisMonth(count || 0);
        setMembersThisMonth((data || []).filter((s) => s.resulted_in_signup).length);
      });
  }, []);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return partners;
    return partners.filter(p => p.status === statusFilter);
  }, [partners, statusFilter]);

  if (selectedPartner) {
    return <PartnerDetail partner={selectedPartner} onBack={() => { setSelectedPartner(null); fetchPartners(); }} onRefresh={fetchPartners} />;
  }

  if (loading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;

  return (
    <div className="space-y-4">
      <PartnerDashboardStats partners={partners} scansThisMonth={scansThisMonth} membersThisMonth={membersThisMonth} />

      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-3 h-3" /> Add Partner</Button>
        <CsvImport onDone={fetchPartners} />
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {["all", ...STATUSES].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-2.5 py-1 rounded-full text-[11px] border transition-all capitalize ${statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-foreground hover:bg-muted"}`}>
            {s} {s !== "all" && `(${partners.filter(p => p.status === s).length})`}
          </button>
        ))}
      </div>

      {/* Partner cards */}
      <div className="space-y-2">
        {filtered.map(p => (
          <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedPartner(p)}>
            <CardContent className="p-3 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{p.venue_name}</p>
                  <Badge className={`text-[10px] ${STATUS_COLORS[p.status]}`}>{p.status}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {getNeighborhoodLabel(p.neighborhood)} · {p.contact_name || "No contact"} · {p.members_acquired || 0} members
                </p>
              </div>
              <QrCode className="w-4 h-4 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No partners found</p>}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif">Add Partner</DialogTitle></DialogHeader>
          <PartnerForm onSave={fetchPartners} onClose={() => setShowAdd(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
