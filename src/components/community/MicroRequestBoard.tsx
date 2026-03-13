import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserContext } from "@/hooks/useUserContext";
import { useSubscription } from "@/hooks/useSubscription";
import { FeatureGate } from "@/components/FeatureGate";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Wrench, Coffee, MessageSquare, Handshake, Sparkles, Plus, CheckCircle2, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { getInitials } from "@/lib/utils";

const TYPE_CONFIG: Record<string, { icon: typeof Wrench; label: string; emoji: string }> = {
  skill_help: { icon: Wrench, label: "Skill Help", emoji: "🔧" },
  coffee_chat: { icon: Coffee, label: "Coffee Chat", emoji: "☕" },
  feedback: { icon: MessageSquare, label: "Feedback", emoji: "💬" },
  collaboration: { icon: Handshake, label: "Collaboration", emoji: "🤝" },
  other: { icon: Sparkles, label: "Other", emoji: "✨" },
};

interface MicroRequest {
  id: string;
  user_id: string;
  request_type: string;
  title: string;
  description: string | null;
  status: string;
  claimed_by: string | null;
  expires_at: string;
  created_at: string;
  profiles?: { display_name: string | null; avatar_url: string | null };
}

export function MicroRequestBoard() {
  return (
    <FeatureGate featureFlag="micro_requests" requireCheckIn>
      <MicroRequestBoardInner />
    </FeatureGate>
  );
}

function MicroRequestBoardInner() {
  const { user } = useAuth();
  const { activeCheckIn } = useUserContext();
  const { getLimit, tier } = useSubscription();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<MicroRequest[]>([]);
  const [myRequests, setMyRequests] = useState<MicroRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState("skill_help");
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const activeLimit = getLimit("micro_requests_active");

  const fetchRequests = async () => {
    if (!user) return;
    const [othersRes, mineRes] = await Promise.all([
      supabase
        .from("micro_requests")
        .select("*, profiles:user_id(display_name, avatar_url)")
        .eq("status", "open")
        .neq("user_id", user.id)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("micro_requests")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["open", "claimed"])
        .order("created_at", { ascending: false }),
    ]);
    setRequests((othersRes.data as unknown as MicroRequest[]) || []);
    setMyRequests(mineRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, [user?.id]);

  const handleClaim = async (requestId: string) => {
    if (!user) return;
    const { data: updated, error } = await supabase
      .from("micro_requests")
      .update({ claimed_by: user.id, status: "claimed" })
      .eq("id", requestId)
      .eq("status", "open")
      .select();
    if (error) { toast.error("Failed to claim"); return; }
    if (!updated || updated.length === 0) {
      toast.error("Already claimed by someone else");
      fetchRequests();
      return;
    }
    toast.success("You claimed this! Introduce yourself.");
    fetchRequests();
  };

  const handleComplete = async (requestId: string) => {
    const { error } = await supabase
      .from("micro_requests")
      .update({ status: "completed" })
      .eq("id", requestId);
    if (error) { toast.error("Failed to complete"); return; }
    toast.success("Request completed! 🎉");
    fetchRequests();
  };

  const handleSubmitNew = async () => {
    if (!user || !formTitle.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("micro_requests").insert({
      user_id: user.id,
      location_id: activeCheckIn?.location_id || null,
      request_type: formType,
      title: formTitle.trim(),
      description: formDesc.trim() || null,
    });
    if (error) { toast.error("Failed to post request"); setSubmitting(false); return; }
    toast.success("Request posted!");
    setFormTitle("");
    setFormDesc("");
    setShowForm(false);
    setSubmitting(false);
    fetchRequests();
  };

  const openCount = myRequests.filter(r => r.status === "open").length;
  const effectiveLimit = activeLimit > 0 ? activeLimit : (activeLimit === -1 ? 999 : 1);
  const atRequestLimit = openCount >= effectiveLimit;

  return (
    <div className="space-y-4">
      <Tabs defaultValue="requests">
        <TabsList className="w-full">
          <TabsTrigger value="requests" className="flex-1">Requests</TabsTrigger>
          <TabsTrigger value="mine" className="flex-1">My Requests</TabsTrigger>
        </TabsList>
...
        <TabsContent value="mine" className="space-y-3 mt-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={atRequestLimit}
                    onClick={() => setShowForm(!showForm)}
                  >
                    <Plus className="w-4 h-4 mr-1" /> New Request
                  </Button>
                </span>
              </TooltipTrigger>
              {atRequestLimit && (
                <TooltipContent><p>Limit of {effectiveLimit} active request{effectiveLimit === 1 ? "" : "s"} reached</p></TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          {atRequestLimit && activeLimit > 0 && activeLimit !== -1 && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="w-3 h-3" />
              <span>You've reached your limit of {effectiveLimit} active request{effectiveLimit === 1 ? "" : "s"}.{tier === "free" ? " Upgrade to Plus for more." : " Upgrade for more."}</span>
              <Button variant="link" size="sm" className="text-xs h-auto p-0" onClick={() => navigate("/pricing")}>See Plans</Button>
            </div>
          )}

          {!atRequestLimit && activeLimit > 0 && activeLimit !== -1 && openCount > 0 && (
            <p className="text-[10px] text-muted-foreground text-center">{openCount} of {effectiveLimit} active request{effectiveLimit === 1 ? "" : "s"} used</p>
          )}

          {showForm && (
            <Card className="border-primary/20">
              <CardContent className="p-3 space-y-3">
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.emoji} {v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="What do you need? (max 100 chars)"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value.slice(0, 100))}
                  maxLength={100}
                  className="text-sm"
                />
                <Textarea
                  placeholder="More details (optional, max 300 chars)"
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value.slice(0, 300))}
                  maxLength={300}
                  className="text-sm min-h-[60px]"
                />
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={handleSubmitNew} disabled={!formTitle.trim() || submitting}>
                    {submitting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                    Post
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {myRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No active requests</p>
          ) : (
            myRequests.map(r => {
              const config = TYPE_CONFIG[r.request_type] || TYPE_CONFIG.other;
              return (
                <Card key={r.id} className="border-border/50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span>{config.emoji}</span>
                        <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                      </div>
                      <Badge variant={r.status === "claimed" ? "default" : "outline"} className="text-[10px] shrink-0 capitalize">
                        {r.status}
                      </Badge>
                    </div>
                    {r.status === "claimed" && (
                      <Button size="sm" variant="outline" className="text-xs h-7 mt-2 w-full" onClick={() => handleComplete(r.id)}>
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Mark Complete
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
