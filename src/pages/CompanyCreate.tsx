import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { trackConversion } from "@/lib/trackConversion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { motion } from "framer-motion";
import { Building2, X, Check } from "lucide-react";
import { FeatureGate } from "@/components/FeatureGate";

const STAGES = [
  { value: "idea", label: "Idea" },
  { value: "pre_seed", label: "Pre-seed" },
  { value: "seed", label: "Seed" },
  { value: "series_a", label: "Series A" },
  { value: "series_b_plus", label: "Series B+" },
  { value: "bootstrapped", label: "Bootstrapped" },
  { value: "profitable", label: "Profitable" },
  { value: "agency", label: "Agency" },
  { value: "freelancer", label: "Freelancer" },
];

const INDUSTRY_OPTIONS = [
  "SaaS", "Fintech", "Healthtech", "Edtech", "AI/ML", "E-commerce", "D2C", "B2B",
  "Developer Tools", "Climate/Sustainability", "Legal", "HR", "Marketing", "Design",
  "Media", "Hardware", "Logistics", "Real Estate", "Food/Beverage", "Travel",
  "Social Impact", "Other",
];

function CompanyCreateTeaser() {
  const navigate = useNavigate();
  return (
    <div className="max-w-lg mx-auto px-4 pt-8 pb-28">
      <Card>
        <CardContent className="pt-6 space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <h2 className="font-serif text-xl text-foreground">Create Your Company Profile</h2>
          <p className="text-sm text-muted-foreground">
            List your company, post what you need and offer, and get matched with complementary businesses.
          </p>
          <div className="space-y-2 text-left max-w-xs mx-auto">
            {["Create company profile", "Post needs & offers", "Get matched with businesses"].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-foreground">
                <Check className="w-4 h-4 text-primary shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Available on Pro plan — ₹499/month</p>
          <Button onClick={() => { trackConversion("clicked_upgrade", { from: "company_create_gate" }); navigate("/pricing"); }} className="w-full">See Plans</Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CompanyCreate() {
  usePageTitle("Create Company — FocusClub");
  const { user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [oneLiner, setOneLiner] = useState("");
  const [stage, setStage] = useState("");
  const [teamSize, setTeamSize] = useState(1);
  const [industryTags, setIndustryTags] = useState<string[]>([]);
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const toggleTag = (tag: string) => {
    setIndustryTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length < 5 ? [...prev, tag] : prev
    );
  };

  const handleSubmit = async () => {
    if (!user || !name.trim() || !oneLiner.trim()) return;
    setSubmitting(true);

    const { data, error } = await supabase
      .from("companies")
      .insert({
        name: name.trim(),
        one_liner: oneLiner.trim(),
        stage: stage || null,
        team_size: teamSize,
        industry_tags: industryTags,
        website: website.trim() || null,
        created_by: user.id,
      })
      .select("id")
      .single();

    setSubmitting(false);
    if (error) {
      toast.error("Failed to create company");
      return;
    }
    toast.success("Company created!");
    navigate(`/company/${data.id}`);
  };

  return (
    <AppShell>
      <FeatureGate requiredTier="pro" teaser={<CompanyCreateTeaser />}>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="max-w-lg mx-auto px-4 pt-4 pb-28 space-y-6"
        >
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-primary" />
            <h1 className="font-serif text-2xl text-foreground">Create Company</h1>
          </div>

          <Card>
            <CardContent className="pt-5 space-y-5">
              <div className="space-y-1.5">
                <Label className="text-sm">Company name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Inc." maxLength={80} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">One-liner *</Label>
                <Input
                  value={oneLiner}
                  onChange={(e) => setOneLiner(e.target.value.slice(0, 120))}
                  placeholder="What does your company do in one sentence?"
                  maxLength={120}
                />
                <p className="text-[10px] text-muted-foreground text-right">{oneLiner.length}/120</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Stage</Label>
                <Select value={stage} onValueChange={setStage}>
                  <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Team size</Label>
                <Input
                  type="number"
                  min={1}
                  max={10000}
                  value={teamSize}
                  onChange={(e) => setTeamSize(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Industry tags (up to 5)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {INDUSTRY_OPTIONS.map((tag) => (
                    <Badge
                      key={tag}
                      variant={industryTags.includes(tag) ? "default" : "outline"}
                      className="cursor-pointer transition-colors text-xs"
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                      {industryTags.includes(tag) && <X className="w-3 h-3 ml-1" />}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Website (optional)</Label>
                <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
              </div>

              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={submitting || !name.trim() || !oneLiner.trim()}
              >
                {submitting ? "Creating..." : "Create Company"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </FeatureGate>
    </AppShell>
  );
}
