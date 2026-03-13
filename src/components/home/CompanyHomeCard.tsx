import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, ArrowRight, Sparkles, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface CompanyMembership {
  company_id: string;
  company_name: string;
  company_logo_url: string | null;
  match_count: number;
  pending_intros: number;
}

export function CompanyHomeCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<CompanyMembership | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const load = async () => {
      // Check if user is a member of any company
      const { data: membership } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!membership) {
        setLoading(false);
        return;
      }

      const companyId = membership.company_id;

      // Fetch company info, match count, and pending intros in parallel
      const [{ data: company }, { data: matches }, { count: introCount }] =
        await Promise.all([
          supabase
            .from("companies")
            .select("name, logo_url")
            .eq("id", companyId)
            .single(),
          supabase.rpc("get_company_matches", { p_company_id: companyId }),
          supabase
            .from("company_intros")
            .select("id", { count: "exact", head: true })
            .eq("to_company_id", companyId)
            .eq("status", "pending"),
        ]);

      if (company) {
        setData({
          company_id: companyId,
          company_name: company.name,
          company_logo_url: company.logo_url,
          match_count: matches?.length || 0,
          pending_intros: introCount || 0,
        });
      }

      setLoading(false);
    };

    load();
  }, [user]);

  // Don't render anything if not loading and no data
  if (loading || !data) return null;

  return (
    <Card className="border-border/60 overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {/* Company logo */}
          <div
            className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer"
            onClick={() => navigate(`/company/${data.company_id}`)}
          >
            {data.company_logo_url ? (
              <img
                src={data.company_logo_url}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <Building2 className="w-5 h-5 text-primary" />
            )}
          </div>

          {/* Company info */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              Your Company
            </p>
            <p
              className="text-sm font-medium text-foreground truncate cursor-pointer hover:underline"
              onClick={() => navigate(`/company/${data.company_id}`)}
            >
              {data.company_name}
            </p>
          </div>

          {/* Quick stats */}
          <div className="flex items-center gap-2 shrink-0">
            {data.match_count > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-green-500/30 text-green-600 gap-0.5"
              >
                <Sparkles className="w-2.5 h-2.5" />
                {data.match_count} {data.match_count === 1 ? "match" : "matches"}
              </Badge>
            )}
            {data.pending_intros > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-blue-500/30 text-blue-600 gap-0.5"
              >
                <Mail className="w-2.5 h-2.5" />
                {data.pending_intros}
              </Badge>
            )}
          </div>
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-2 mt-3">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 flex-1"
            onClick={() => navigate(`/company/${data.company_id}`)}
          >
            <Building2 className="w-3 h-3 mr-1" /> Profile
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 flex-1"
            onClick={() => navigate("/companies")}
          >
            <Sparkles className="w-3 h-3 mr-1" /> Browse Companies
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
