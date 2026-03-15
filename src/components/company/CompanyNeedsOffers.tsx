import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, X, Search, HandHelping, Briefcase } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  hiring: "We're hiring",
  interns: "Looking for interns",
  investment: "Raising funds",
  customers: "Finding customers",
  partnerships: "Seeking partners",
  collaborators: "Open to collaborate",
  mentorship: "Need mentorship",
  shared_services: "Shared services",
  office_space: "Office space",
  expertise: "Can share expertise",
  other: "Other",
};

const NEED_TYPES = ["hiring", "interns", "investment", "customers", "partnerships", "collaborators", "mentorship", "shared_services", "office_space", "other"];
const OFFER_TYPES = ["hiring", "interns", "investment", "customers", "partnerships", "collaborators", "mentorship", "shared_services", "expertise", "other"];

interface NeedOffer {
  id: string;
  need_type?: string;
  offer_type?: string;
  title: string;
  description: string | null;
  is_active: boolean;
}

function AddItemDialog({ kind, companyId, onAdded }: { kind: "need" | "offer"; companyId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const types = kind === "need" ? NEED_TYPES : OFFER_TYPES;
  const table = kind === "need" ? "company_needs" : "company_offers";
  const typeCol = kind === "need" ? "need_type" : "offer_type";

  const handleSubmit = async () => {
    if (!type || !title.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from(table).insert({
      company_id: companyId,
      [typeCol]: type,
      title: title.trim(),
      description: description.trim() || null,
    } as any);
    setSubmitting(false);
    if (error) {
      toast.error(error.code === "23505" ? "Already exists" : "Failed to add");
      return;
    }
    toast.success("Added!");
    setOpen(false);
    setType("");
    setTitle("");
    setDescription("");
    onAdded();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add {kind === "need" ? "a need" : "an offer"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              {types.map((t) => (
                <SelectItem key={t} value={t}>{TYPE_LABELS[t] || t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Short title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
          <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value.slice(0, 200))} maxLength={200} className="min-h-[60px]" />
          <Button className="w-full" onClick={handleSubmit} disabled={submitting || !type || !title.trim()}>
            {submitting ? "Adding..." : "Add"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ItemCard({ item, kind, isAdmin, onRemoved }: { item: NeedOffer; kind: "need" | "offer"; isAdmin: boolean; onRemoved: () => void }) {
  const typeKey = kind === "need" ? item.need_type : item.offer_type;
  const table = kind === "need" ? "company_needs" : "company_offers";

  const handleRemove = async () => {
    await supabase.from(table).delete().eq("id", item.id);
    toast.success("Removed");
    onRemoved();
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        {kind === "need" ? <Search className="w-4 h-4 text-primary" /> : <HandHelping className="w-4 h-4 text-secondary" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[typeKey || ""] || typeKey}</Badge>
        </div>
        <p className="text-sm font-medium text-foreground mt-1">{item.title}</p>
        {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
      </div>
      {isAdmin && (
        <Button size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0" onClick={handleRemove}>
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      )}
    </div>
  );
}

export function CompanyNeedsOffers({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
  const [needs, setNeeds] = useState<NeedOffer[]>([]);
  const [offers, setOffers] = useState<NeedOffer[]>([]);

  const fetchAll = useCallback(async () => {
    const [needsRes, offersRes] = await Promise.all([
      supabase.from("company_needs").select("*").eq("company_id", companyId).eq("is_active", true).order("created_at"),
      supabase.from("company_offers").select("*").eq("company_id", companyId).eq("is_active", true).order("created_at"),
    ]);
    if (needsRes.data) setNeeds(needsRes.data as NeedOffer[]);
    if (offersRes.data) setOffers(offersRes.data as NeedOffer[]);
  }, [companyId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const hasContent = needs.length > 0 || offers.length > 0 || isAdmin;
  if (!hasContent) return null;

  return (
    <>
      {/* Needs */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-base text-foreground flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" /> Looking For
            </h2>
            {isAdmin && <AddItemDialog kind="need" companyId={companyId} onAdded={fetchAll} />}
          </div>
          {needs.length === 0 && (
            <p className="text-xs text-muted-foreground">No active needs yet{isAdmin ? " — add what your company is looking for" : ""}</p>
          )}
          {needs.map((n) => (
            <ItemCard key={n.id} item={n} kind="need" isAdmin={isAdmin} onRemoved={fetchAll} />
          ))}
        </CardContent>
      </Card>

      {/* Offers */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-base text-foreground flex items-center gap-2">
              <HandHelping className="w-4 h-4 text-secondary" /> Can Offer
            </h2>
            {isAdmin && <AddItemDialog kind="offer" companyId={companyId} onAdded={fetchAll} />}
          </div>
          {offers.length === 0 && (
            <p className="text-xs text-muted-foreground">No active offers yet{isAdmin ? " — add what your company can provide" : ""}</p>
          )}
          {offers.map((o) => (
            <ItemCard key={o.id} item={o} kind="offer" isAdmin={isAdmin} onRemoved={fetchAll} />
          ))}
        </CardContent>
      </Card>
    </>
  );
}
