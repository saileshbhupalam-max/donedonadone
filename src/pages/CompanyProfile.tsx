import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useParams, useNavigate } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { motion } from "framer-motion";
import { Building2, Globe, Users, Pencil, Copy, UserPlus, LogOut } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { CompanyNeedsOffers } from "@/components/company/CompanyNeedsOffers";
import { CompanyMatches } from "@/components/company/CompanyMatches";
import { CompanyIntros } from "@/components/company/CompanyIntros";
import { CompanyAnalytics } from "@/components/company/CompanyAnalytics";
import { FeatureGate } from "@/components/FeatureGate";

const STAGE_LABELS: Record<string, string> = {
  idea: "Idea", pre_seed: "Pre-seed", seed: "Seed", series_a: "Series A",
  series_b_plus: "Series B+", bootstrapped: "Bootstrapped", profitable: "Profitable",
  agency: "Agency", freelancer: "Freelancer",
};

interface Company {
  id: string;
  name: string;
  one_liner: string | null;
  stage: string | null;
  team_size: number | null;
  industry_tags: string[] | null;
  website: string | null;
  logo_url: string | null;
  created_by: string;
}

interface Member {
  id: string;
  user_id: string;
  role: string;
  display_name: string | null;
  avatar_url: string | null;
}

export default function CompanyProfile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [company, setCompany] = useState<Company | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [userMembership, setUserMembership] = useState<{ company_id: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  usePageTitle(company ? `${company.name} — donedonadone` : "Company — donedonadone");

  useEffect(() => {
    if (!id || !user) return;
    const load = async () => {
      setLoading(true);
      const [companyRes, membersRes, myMembershipRes] = await Promise.all([
        supabase.from("companies").select("*").eq("id", id).single(),
        supabase.from("company_members").select("id, user_id, role, profiles(display_name, avatar_url)").eq("company_id", id),
        supabase.from("company_members").select("company_id, role").eq("user_id", user.id).limit(1).maybeSingle(),
      ]);

      if (companyRes.data) setCompany(companyRes.data as Company);
      if (membersRes.data) {
        setMembers(
          membersRes.data.map((m: any) => ({
            id: m.id,
            user_id: m.user_id,
            role: m.role,
            display_name: m.profiles?.display_name,
            avatar_url: m.profiles?.avatar_url,
          }))
        );
      }
      if (myMembershipRes.data) setUserMembership(myMembershipRes.data);
      setLoading(false);
    };
    load();
  }, [id, user]);

  const isFounder = userMembership?.company_id === id && userMembership?.role === "founder";
  const isCompanyAdmin = userMembership?.company_id === id && (userMembership?.role === "founder" || userMembership?.role === "admin");
  const isMember = userMembership?.company_id === id;
  const hasAnyCompany = !!userMembership;

  const handleJoin = async () => {
    if (!user || !id) return;
    setJoining(true);
    const { error } = await supabase.from("company_members").insert({ company_id: id, user_id: user.id, role: "member" });
    setJoining(false);
    if (error) {
      toast.error(error.code === "23505" ? "Already a member" : "Failed to join");
      return;
    }
    toast.success("Joined company!");
    setUserMembership({ company_id: id, role: "member" });
    // Refresh members
    const { data } = await supabase.from("company_members").select("id, user_id, role, profiles(display_name, avatar_url)").eq("company_id", id);
    if (data) setMembers(data.map((m: any) => ({ id: m.id, user_id: m.user_id, role: m.role, display_name: m.profiles?.display_name, avatar_url: m.profiles?.avatar_url })));
  };

  const handleLeave = async () => {
    if (!user || !id) return;
    const { error } = await supabase.from("company_members").delete().eq("company_id", id).eq("user_id", user.id);
    if (error) { toast.error("Failed to leave"); return; }
    toast.success("Left company");
    setUserMembership(null);
    setMembers((prev) => prev.filter((m) => m.user_id !== user.id));
  };

  const handleCopyInvite = () => {
    const url = `${window.location.origin}/company/${id}`;
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied!");
  };

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-lg mx-auto px-4 pt-4 pb-28 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </AppShell>
    );
  }

  if (!company) {
    return (
      <AppShell>
        <div className="max-w-lg mx-auto px-4 pt-16 text-center">
          <p className="text-muted-foreground">Company not found</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="max-w-lg mx-auto px-4 pt-4 pb-28 space-y-5"
      >
        {/* Header */}
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  {company.logo_url ? (
                    <img src={company.logo_url} alt={company.name} className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <Building2 className="w-6 h-6 text-primary" />
                  )}
                </div>
                <div>
                  <h1 className="font-serif text-xl text-foreground">{company.name}</h1>
                  {company.stage && (
                    <Badge variant="secondary" className="text-[10px] mt-0.5">
                      {STAGE_LABELS[company.stage] || company.stage}
                    </Badge>
                  )}
                </div>
              </div>
              {isFounder && (
                <Button size="icon" variant="ghost" onClick={() => toast.info("Edit coming soon")}>
                  <Pencil className="w-4 h-4" />
                </Button>
              )}
            </div>

            {company.one_liner && (
              <p className="text-sm text-muted-foreground">{company.one_liner}</p>
            )}

            <div className="flex flex-wrap gap-1.5">
              {company.industry_tags?.map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
              ))}
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {company.team_size && (
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> {company.team_size} people
                </span>
              )}
              {company.website && (
                <a
                  href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <Globe className="w-3.5 h-3.5" /> Website
                </a>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        {!isMember && !hasAnyCompany && (
          <Button className="w-full gap-2" onClick={handleJoin} disabled={joining}>
            <UserPlus className="w-4 h-4" /> {joining ? "Joining..." : "Join this company"}
          </Button>
        )}

        {isFounder && (
          <Button variant="outline" className="w-full gap-2" onClick={handleCopyInvite}>
            <Copy className="w-4 h-4" /> Copy invite link
          </Button>
        )}

        {/* Team */}
        <Card>
          <CardContent className="pt-5 space-y-3">
            <h2 className="font-serif text-base text-foreground">Team ({members.length})</h2>
            <Separator />
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => navigate(`/profile/${m.user_id}`)}
                className="flex items-center gap-3 w-full text-left p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Avatar className="w-9 h-9">
                  <AvatarImage src={m.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {getInitials(m.display_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{m.display_name || "Member"}</p>
                </div>
                <Badge variant="outline" className="text-[10px] capitalize">{m.role}</Badge>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Needs & Offers */}
        <CompanyNeedsOffers companyId={id!} isAdmin={isCompanyAdmin} />

        {/* Business Matches (only for members) */}
        {isMember && (
          <FeatureGate requiredTier="pro">
            <CompanyMatches companyId={id!} />
          </FeatureGate>
        )}

        {/* Intros */}
        {isMember && (
          <FeatureGate requiredTier="pro">
            <CompanyIntros companyId={id!} isAdmin={isCompanyAdmin} />
          </FeatureGate>
        )}

        {/* Company Analytics */}
        {isMember && (
          <CompanyAnalytics companyId={id!} />
        )}

        {/* Leave */}
        {isMember && !isFounder && (
          <Button variant="ghost" className="w-full gap-2 text-destructive hover:text-destructive" onClick={handleLeave}>
            <LogOut className="w-4 h-4" /> Leave company
          </Button>
        )}
      </motion.div>
    </AppShell>
  );
}
