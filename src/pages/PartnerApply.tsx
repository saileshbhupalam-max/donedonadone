import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, MapPin, CheckCircle2, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const VENUE_TYPES = [
  { value: "cafe", label: "☕ Café" },
  { value: "coworking_space", label: "🏢 Coworking Space" },
  { value: "tech_park", label: "🏗️ Tech Park" },
  { value: "neighborhood", label: "📍 Neighborhood Hub" },
  { value: "other", label: "🏠 Other" },
];

const AMENITIES = [
  "WiFi", "Power Outlets", "AC", "Parking", "Food & Drinks",
  "Meeting Rooms", "Standing Desks", "Quiet Zone", "Outdoor Seating",
];

interface FormData {
  venue_name: string;
  venue_type: string;
  address: string;
  neighborhood: string;
  description: string;
  amenities: string[];
  wifi_available: boolean;
  seating_capacity: string;
  contact_phone: string;
  contact_email: string;
  latitude: string;
  longitude: string;
}

const initialForm: FormData = {
  venue_name: "", venue_type: "", address: "", neighborhood: "",
  description: "", amenities: [], wifi_available: true, seating_capacity: "",
  contact_phone: "", contact_email: "", latitude: "", longitude: "",
};

function Step1({ form, setForm }: { form: FormData; setForm: (f: FormData) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Venue Name *</Label>
        <Input value={form.venue_name} onChange={(e) => setForm({ ...form, venue_name: e.target.value })} placeholder="e.g., Third Wave Coffee" />
      </div>
      <div>
        <Label>Venue Type *</Label>
        <Select value={form.venue_type} onValueChange={(v) => setForm({ ...form, venue_type: v })}>
          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
          <SelectContent>
            {VENUE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Address *</Label>
        <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Full address" rows={2} />
      </div>
      <div>
        <Label>Neighborhood *</Label>
        <Input value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} placeholder="e.g., Koramangala" />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, 500) })}
          placeholder="Tell us about your space..."
          rows={3}
        />
        <p className="text-[10px] text-muted-foreground mt-1">{form.description.length}/500</p>
      </div>
    </div>
  );
}

function Step2({ form, setForm }: { form: FormData; setForm: (f: FormData) => void }) {
  const toggleAmenity = (a: string) => {
    setForm({
      ...form,
      amenities: form.amenities.includes(a)
        ? form.amenities.filter((x) => x !== a)
        : [...form.amenities, a],
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Amenities</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {AMENITIES.map((a) => (
            <Badge
              key={a}
              variant={form.amenities.includes(a) ? "default" : "outline"}
              className="cursor-pointer text-xs px-3 py-1"
              onClick={() => toggleAmenity(a)}
            >
              {a}
            </Badge>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Label>WiFi Available</Label>
        <Switch checked={form.wifi_available} onCheckedChange={(c) => setForm({ ...form, wifi_available: c })} />
      </div>
      <div>
        <Label>Seating Capacity</Label>
        <Input type="number" value={form.seating_capacity} onChange={(e) => setForm({ ...form, seating_capacity: e.target.value })} placeholder="e.g., 50" />
      </div>
      <div>
        <Label>Contact Phone</Label>
        <Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} placeholder="+91 98765 43210" />
      </div>
      <div>
        <Label>Contact Email</Label>
        <Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} placeholder="manager@venue.com" />
      </div>
    </div>
  );
}

function Step3({ form, setForm }: { form: FormData; setForm: (f: FormData) => void }) {
  const [locating, setLocating] = useState(false);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) { toast.error("Geolocation not supported"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm({ ...form, latitude: String(pos.coords.latitude), longitude: String(pos.coords.longitude) });
        setLocating(false);
        toast.success("Location detected!");
      },
      () => { setLocating(false); toast.error("Could not get location"); },
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Help us pinpoint your venue on the map.</p>
      <Button variant="outline" className="w-full" onClick={useCurrentLocation} disabled={locating}>
        {locating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MapPin className="w-4 h-4 mr-2" />}
        {locating ? "Detecting..." : "Use my current location"}
      </Button>
      <div className="relative flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">or enter manually</span>
        <div className="flex-1 h-px bg-border" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Latitude</Label>
          <Input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="12.9141" />
        </div>
        <div>
          <Label>Longitude</Label>
          <Input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="77.6389" />
        </div>
      </div>
      {form.latitude && form.longitude && (
        <p className="text-xs text-primary">📍 Location set: {Number(form.latitude).toFixed(4)}, {Number(form.longitude).toFixed(4)}</p>
      )}
      <p className="text-xs text-muted-foreground">We'll verify the location before approving.</p>
    </div>
  );
}

function Step4({ form }: { form: FormData }) {
  const typeLabel = VENUE_TYPES.find((t) => t.value === form.venue_type)?.label || form.venue_type;
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">Review your application</p>
      <Card><CardContent className="p-3 space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Venue</span><span className="font-medium text-foreground">{form.venue_name}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="text-foreground">{typeLabel}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Address</span><span className="text-foreground text-right max-w-[60%]">{form.address}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Neighborhood</span><span className="text-foreground">{form.neighborhood}</span></div>
        {form.description && <div><span className="text-muted-foreground">Description</span><p className="text-foreground mt-1">{form.description}</p></div>}
        {form.amenities.length > 0 && (
          <div><span className="text-muted-foreground">Amenities</span>
            <div className="flex flex-wrap gap-1 mt-1">{form.amenities.map((a) => <Badge key={a} variant="secondary" className="text-[10px]">{a}</Badge>)}</div>
          </div>
        )}
        {form.seating_capacity && <div className="flex justify-between"><span className="text-muted-foreground">Capacity</span><span className="text-foreground">{form.seating_capacity} seats</span></div>}
        <div className="flex justify-between"><span className="text-muted-foreground">WiFi</span><span className="text-foreground">{form.wifi_available ? "Yes" : "No"}</span></div>
        {form.latitude && <div className="flex justify-between"><span className="text-muted-foreground">Location</span><span className="text-foreground">{Number(form.latitude).toFixed(4)}, {Number(form.longitude).toFixed(4)}</span></div>}
      </CardContent></Card>
    </div>
  );
}

export default function PartnerApply() {
  usePageTitle("Partner Application — FocusClub");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const steps = ["Basics", "Details", "Location", "Review"];

  const canNext = () => {
    if (step === 0) return form.venue_name && form.venue_type && form.address && form.neighborhood;
    return true;
  };

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("partner_applications").insert({
        user_id: user.id,
        venue_name: form.venue_name.trim(),
        venue_type: form.venue_type,
        address: form.address.trim(),
        neighborhood: form.neighborhood.trim(),
        city: "Bangalore",
        description: form.description.trim() || null,
        amenities: form.amenities,
        wifi_available: form.wifi_available,
        seating_capacity: form.seating_capacity ? parseInt(form.seating_capacity) : null,
        contact_phone: form.contact_phone.trim() || null,
        contact_email: form.contact_email.trim() || null,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
      });
      if (error) {
        if (error.code === "23505") { toast.error("You already have an application submitted"); }
        else throw error;
      } else {
        setSubmitted(true);
      }
    } catch (e: any) {
      console.error("[PartnerApply]", e);
      toast.error("Something went wrong submitting your application");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-4">
          <CheckCircle2 className="w-16 h-16 text-primary" />
          <h1 className="font-serif text-2xl text-foreground">Application Submitted!</h1>
          <p className="text-sm text-muted-foreground max-w-sm">We'll review your application within 48 hours. You'll receive a notification once it's been reviewed.</p>
          <Button onClick={() => navigate("/home")}>Back to Home</Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
        <h1 className="font-serif text-2xl text-foreground">List Your Venue</h1>
        <p className="text-xs text-muted-foreground">Join FocusClub as a partner venue and attract focused professionals to your space.</p>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            {steps.map((s, i) => (
              <span key={s} className={i <= step ? "text-primary font-medium" : ""}>{s}</span>
            ))}
          </div>
          <Progress value={((step + 1) / steps.length) * 100} className="h-1" />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.15 }}
          >
            {step === 0 && <Step1 form={form} setForm={setForm} />}
            {step === 1 && <Step2 form={form} setForm={setForm} />}
            {step === 2 && <Step3 form={form} setForm={setForm} />}
            {step === 3 && <Step4 form={form} />}
          </motion.div>
        </AnimatePresence>

        <div className="flex gap-3 pt-2">
          {step > 0 && (
            <Button variant="outline" className="flex-1" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          )}
          {step < 3 ? (
            <Button className="flex-1" onClick={() => setStep(step + 1)} disabled={!canNext()}>
              Next <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {submitting ? "Submitting..." : "Submit Application"}
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
