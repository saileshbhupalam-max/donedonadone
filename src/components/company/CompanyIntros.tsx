import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { getInitials } from "@/lib/utils";
import { Mail, Check, X, Building2 } from "lucide-react";

interface Intro {
  id: string;
  from_company_id: string;
  to_company_id: string;
  from_user_id: string;
  message: string | null;
  status: string;
  created_at: string;
  from_company?: { name: string; logo_url: string | null };
  to_company?: { name: string; logo_url: string | null };
  from_user?: { display_name: string | null; avatar_url: string | null };
}

export function CompanyIntros({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [received, setReceived] = useState<Intro[]>([]);
  const [sent, setSent] = useState<Intro[]>([]);

  const fetchIntros = async () => {
    const [recvRes, sentRes] = await Promise.all([
      supabase
        .from("company_intros")
        .select("*, from_company:companies!company_intros_from_company_id_fkey(name, logo_url), from_user:profiles!company_intros_from_user_id_fkey(display_name, avatar_url)")
        .eq("to_company_id", companyId)
        .order("created_at", { ascending: false }),
      supabase
        .from("company_intros")
        .select("*, to_company:companies!company_intros_to_company_id_fkey(name, logo_url)")
        .eq("from_company_id", companyId)
        .order("created_at", { ascending: false }),
    ]);
    if (recvRes.data) setReceived(recvRes.data.map((d: any) => ({
      ...d,
      from_company: d.from_company,
      from_user: d.from_user,
    })));
    if (sentRes.data) setSent(sentRes.data.map((d: any) => ({
      ...d,
      to_company: d.to_company,
    })));
  };

  useEffect(() => { fetchIntros(); }, [companyId]);

  const handleRespond = async (introId: string, status: "accepted" | "declined") => {
    const { error } = await supabase.from("company_intros").update({ status }).eq("id", introId);
    if (error) { toast.error("Failed to respond"); return; }
    toast.success(status === "accepted" ? "Intro accepted!" : "Intro declined");
    fetchIntros();
  };

  const hasContent = received.length > 0 || sent.length > 0;
  if (!hasContent) return null;

  const statusColor = (s: string) => s === "accepted" ? "default" : s === "declined" ? "destructive" : "secondary";

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <h2 className="font-serif text-base text-foreground flex items-center gap-2">
          <Mail className="w-4 h-4 text-primary" /> Intros
        </h2>

        {received.length > 0 && (
          <>
            <p className="text-xs font-medium text-foreground">Received</p>
            {received.map((intro) => (
              <div key={intro.id} className="p-3 rounded-lg border border-border space-y-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <button onClick={() => navigate(`/company/${intro.from_company_id}`)} className="text-sm font-medium text-foreground hover:underline truncate block">
                      {intro.from_company?.name || "Company"}
                    </button>
                    {intro.from_user && (
                      <p className="text-[10px] text-muted-foreground">via {intro.from_user.display_name || "someone"}</p>
                    )}
                  </div>
                  <Badge variant={statusColor(intro.status)} className="text-[9px] capitalize">{intro.status}</Badge>
                </div>
                {intro.message && <p className="text-xs text-muted-foreground pl-10">{intro.message}</p>}
                {intro.status === "pending" && isAdmin && (
                  <div className="flex gap-2 pl-10">
                    <Button size="sm" className="gap-1 h-7 text-xs" onClick={() => handleRespond(intro.id, "accepted")}>
                      <Check className="w-3 h-3" /> Accept
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => handleRespond(intro.id, "declined")}>
                      <X className="w-3 h-3" /> Decline
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {received.length > 0 && sent.length > 0 && <Separator />}

        {sent.length > 0 && (
          <>
            <p className="text-xs font-medium text-foreground">Sent</p>
            {sent.map((intro) => (
              <div key={intro.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                </div>
                <button onClick={() => navigate(`/company/${intro.to_company_id}`)} className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-foreground truncate">{intro.to_company?.name || "Company"}</p>
                </button>
                <Badge variant={statusColor(intro.status)} className="text-[9px] capitalize">{intro.status}</Badge>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
