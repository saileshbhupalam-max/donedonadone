import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { CheckCircle2, XCircle, MapPin } from "lucide-react";

interface Application {
  id: string;
  user_id: string;
  venue_name: string;
  venue_type: string;
  address: string;
  neighborhood: string;
  city: string;
  description: string | null;
  amenities: string[];
  wifi_available: boolean;
  seating_capacity: number | null;
  contact_phone: string | null;
  contact_email: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  applicant_name?: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-destructive/10 text-destructive",
};

const TYPE_LABELS: Record<string, string> = {
  cafe: "☕ Café",
  coworking_space: "🏢 Coworking",
  tech_park: "🏗️ Tech Park",
  neighborhood: "📍 Neighborhood",
  other: "🏠 Other",
};

export function PartnerApplicationsTab() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectDialog, setRejectDialog] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchApplications = async () => {
    const { data } = await supabase
      .from("partner_applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (!data) { setLoading(false); return; }

    // Get applicant names
    const userIds = data.map((a) => a.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);

    const nameMap: Record<string, string> = {};
    (profiles || []).forEach((p) => { nameMap[p.id] = p.display_name || "Unknown"; });

    setApplications(data.map((a) => ({ ...a, applicant_name: nameMap[a.user_id] || "Unknown" })) as Application[]);
    setLoading(false);
  };

  useEffect(() => { fetchApplications(); }, []);

  const handleApprove = async (id: string) => {
    setProcessing(id);
    try {
      const { error } = await supabase.rpc("approve_partner_application", { p_application_id: id });
      if (error) throw error;
      toast.success("Application approved! Location created.");
      fetchApplications();
    } catch (e: any) {
      console.error("[ApprovePartner]", e);
      toast.error(e.message || "Failed to approve");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!rejectDialog) return;
    setProcessing(rejectDialog);
    try {
      const { error } = await supabase.rpc("reject_partner_application", {
        p_application_id: rejectDialog,
        p_reason: rejectReason.trim() || null,
      });
      if (error) throw error;
      toast.success("Application rejected");
      setRejectDialog(null);
      setRejectReason("");
      fetchApplications();
    } catch (e: any) {
      console.error("[RejectPartner]", e);
      toast.error(e.message || "Failed to reject");
    } finally {
      setProcessing(null);
    }
  };

  // Sort: pending first, then approved, then rejected
  const sorted = [...applications].sort((a, b) => {
    const order: Record<string, number> = { pending: 0, approved: 1, rejected: 2 };
    return (order[a.status] ?? 3) - (order[b.status] ?? 3);
  });

  if (loading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;

  if (sorted.length === 0) {
    return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No partner applications yet</CardContent></Card>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{applications.filter((a) => a.status === "pending").length} pending · {applications.length} total</p>

      {sorted.map((app) => (
        <Card key={app.id}>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{app.venue_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">{TYPE_LABELS[app.venue_type] || app.venue_type}</span>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <span className="text-[10px] text-muted-foreground">{app.neighborhood}</span>
                </div>
              </div>
              <Badge className={`text-[10px] shrink-0 ${STATUS_COLORS[app.status] || ""}`}>{app.status}</Badge>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>By {app.applicant_name}</span>
              <span>·</span>
              <span>{format(parseISO(app.created_at), "MMM d, yyyy")}</span>
            </div>

            {app.description && <p className="text-xs text-muted-foreground line-clamp-2">{app.description}</p>}

            {app.amenities?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {app.amenities.slice(0, 5).map((a) => <Badge key={a} variant="outline" className="text-[9px] px-1.5 py-0">{a}</Badge>)}
                {app.amenities.length > 5 && <span className="text-[9px] text-muted-foreground">+{app.amenities.length - 5}</span>}
              </div>
            )}

            {app.latitude && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <MapPin className="w-3 h-3" /> {app.latitude.toFixed(4)}, {app.longitude?.toFixed(4)}
              </div>
            )}

            {app.status === "pending" && (
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="flex-1 text-xs h-8"
                  onClick={() => handleApprove(app.id)}
                  disabled={processing === app.id}
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs h-8"
                  onClick={() => { setRejectDialog(app.id); setRejectReason(""); }}
                  disabled={processing === app.id}
                >
                  <XCircle className="w-3 h-3 mr-1" /> Reject
                </Button>
              </div>
            )}

            {app.status === "rejected" && app.rejection_reason && (
              <p className="text-[10px] text-destructive">Reason: {app.rejection_reason}</p>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Reject dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={(o) => !o && setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Application</DialogTitle></DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection (optional)..."
            rows={3}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={processing !== null}>Reject</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
