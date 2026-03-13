import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Search, Users, CreditCard, Zap, IndianRupee } from "lucide-react";
import { format, parseISO } from "date-fns";

// ─── Stats Cards ─────────────────────────────────────────
function SubscriptionStats() {
  const [stats, setStats] = useState<{
    total: number; free: number; paid: number; revenueEstimate: number;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: subs }, { data: tiers }, { count: totalUsers }] = await Promise.all([
        supabase.from("user_subscriptions").select("tier_id, status").eq("status", "active"),
        supabase.from("subscription_tiers").select("id, price_monthly, sort_order"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);

      const tierPriceMap: Record<string, number> = {};
      (tiers || []).forEach((t) => { tierPriceMap[t.id] = t.price_monthly || 0; });

      let free = 0, paid = 0, revenue = 0;
      (subs || []).forEach((s) => {
        if (s.tier_id === "free") free++;
        else { paid++; revenue += tierPriceMap[s.tier_id] || 0; }
      });

      setStats({ total: totalUsers || 0, free, paid, revenueEstimate: revenue });
    })();
  }, []);

  if (!stats) return <div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;

  const cards = [
    { label: "Total Users", value: stats.total, icon: Users },
    { label: "Free Users", value: stats.free, icon: Users },
    { label: "Paid Users", value: stats.paid, icon: CreditCard },
    { label: "Revenue Est.", value: `₹${Math.round(stats.revenueEstimate / 100).toLocaleString("en-IN")}/mo`, icon: IndianRupee },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <c.icon className="w-3.5 h-3.5" />
              <span className="text-[11px]">{c.label}</span>
            </div>
            <p className="text-xl font-bold text-foreground">{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── User Subscription Management ────────────────────────
function UserSubManagement() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [userSub, setUserSub] = useState<any>(null);
  const [newTier, setNewTier] = useState("");
  const [saving, setSaving] = useState(false);
  const [granting, setGranting] = useState(false);

  const tierOrder: Record<string, string> = { free: "plus", plus: "pro", pro: "max", max: "max" };

  const searchUsers = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, email, avatar_url, subscription_tier")
      .or(`display_name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(10);
    setResults(data || []);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchUsers(search), 300);
    return () => clearTimeout(t);
  }, [search, searchUsers]);

  const selectUser = async (user: any) => {
    setSelected(user);
    setResults([]);
    setSearch(user.display_name || user.email || "");
    const { data } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    setUserSub(data);
    setNewTier(data?.tier_id || "free");
  };

  const saveTier = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      if (userSub) {
        await supabase.from("user_subscriptions").update({ tier_id: newTier }).eq("id", userSub.id);
      } else {
        await supabase.from("user_subscriptions").insert({
          user_id: selected.id,
          tier_id: newTier,
          status: "active",
          payment_provider: "manual",
          billing_cycle: "monthly",
        });
      }
      toast.success(`Updated ${selected.display_name || selected.email} to ${newTier}`);
      setUserSub({ ...userSub, tier_id: newTier });
    } catch (e: any) {
      toast.error(e.message || "Failed to update");
    }
    setSaving(false);
  };

  const grantBoost = async () => {
    if (!selected) return;
    setGranting(true);
    const currentTier = userSub?.tier_id || "free";
    const boostTier = tierOrder[currentTier] || "plus";
    try {
      const { error } = await supabase.from("session_boosts").insert({
        user_id: selected.id,
        boost_tier: boostTier,
        amount_paise: 0,
        payment_id: null,
      });
      if (error) throw error;
      toast.success(`Granted 24hr ${boostTier} boost to ${selected.display_name || selected.email}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to grant boost");
    }
    setGranting(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">User Subscription Management</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
            placeholder="Search by name or email..."
            className="pl-9"
          />
        </div>

        {results.length > 0 && !selected && (
          <div className="border rounded-md max-h-48 overflow-y-auto">
            {results.map((u) => (
              <button
                key={u.id}
                className="w-full px-3 py-2 text-left hover:bg-muted/50 flex items-center gap-2 border-b last:border-0"
                onClick={() => selectUser(u)}
              >
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                  {(u.display_name || "?")[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{u.display_name || "—"}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">{u.subscription_tier || "free"}</Badge>
              </button>
            ))}
          </div>
        )}

        {selected && (
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-medium text-muted-foreground">
                {(selected.display_name || "?")[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{selected.display_name || "—"}</p>
                <p className="text-xs text-muted-foreground">{selected.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <span>Current tier: <strong className="text-foreground">{userSub?.tier_id || "free"}</strong></span>
              <span>Status: <strong className="text-foreground">{userSub?.status || "none"}</strong></span>
              {userSub?.started_at && (
                <span>Since: <strong className="text-foreground">{format(parseISO(userSub.started_at), "MMM d, yyyy")}</strong></span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Select value={newTier} onValueChange={setNewTier}>
                <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["free", "plus", "pro", "max"].map((t) => (
                    <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={saveTier} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button size="sm" variant="outline" onClick={grantBoost} disabled={granting}>
                <Zap className="w-3.5 h-3.5 mr-1" />
                {granting ? "..." : "Boost"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Tier Overview ───────────────────────────────────────
function TierOverview() {
  const [tiers, setTiers] = useState<any[]>([]);
  const [subCounts, setSubCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: tierData }, { data: subs }] = await Promise.all([
        supabase.from("subscription_tiers").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("user_subscriptions").select("tier_id").eq("status", "active"),
      ]);
      setTiers(tierData || []);
      const counts: Record<string, number> = {};
      (subs || []).forEach((s) => { counts[s.tier_id] = (counts[s.tier_id] || 0) + 1; });
      setSubCounts(counts);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Skeleton className="h-40" />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Tier Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md overflow-hidden">
          <div className="grid grid-cols-[1fr_80px_80px_60px_60px] gap-1 px-3 py-2 bg-muted text-[10px] font-medium text-muted-foreground uppercase">
            <span>Tier</span><span>Monthly</span><span>Yearly</span><span>Order</span><span>Users</span>
          </div>
          {tiers.map((t) => (
            <div key={t.id} className="grid grid-cols-[1fr_80px_80px_60px_60px] gap-1 px-3 py-2 border-t items-center">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.badge_color === "gray" ? "hsl(var(--muted-foreground))" : t.badge_color }} />
                <div>
                  <p className="text-sm font-medium text-foreground">{t.name}</p>
                  <p className="text-[10px] text-muted-foreground">{t.description}</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">₹{Math.round(t.price_monthly / 100)}</span>
              <span className="text-xs text-muted-foreground">₹{Math.round(t.price_yearly / 100)}</span>
              <span className="text-xs text-muted-foreground">{t.sort_order}</span>
              <Badge variant="secondary" className="text-[10px] justify-center">{subCounts[t.id] || 0}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Feature Management ──────────────────────────────────
function FeatureManagement() {
  const [features, setFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchFeatures = async () => {
    const { data } = await supabase.from("tier_features").select("*").order("sort_order");
    setFeatures(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchFeatures(); }, []);

  const updateFeature = async (featureKey: string, updates: Record<string, any>) => {
    setSavingId(featureKey);
    const { error } = await supabase.from("tier_features").update(updates).eq("feature_key", featureKey);
    if (error) toast.error(error.message);
    else toast.success(`Updated ${featureKey}`);
    setSavingId(null);
    fetchFeatures();
  };

  if (loading) return <Skeleton className="h-60" />;

  const categories = [...new Set(features.map((f) => f.category))];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Feature Management</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {categories.map((cat) => (
          <div key={cat}>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">{cat}</p>
            <div className="border rounded-md overflow-hidden">
              {features.filter((f) => f.category === cat).map((f) => (
                <div key={f.feature_key} className="flex items-center gap-2 px-3 py-2 border-b last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{f.label}</p>
                    <p className="text-[10px] text-muted-foreground">{f.feature_key}</p>
                  </div>
                  <Select
                    value={f.min_tier_id}
                    onValueChange={(val) => updateFeature(f.feature_key, { min_tier_id: val })}
                  >
                    <SelectTrigger className="w-20 h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["free", "plus", "pro", "max"].map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Switch
                    checked={f.is_active}
                    onCheckedChange={(val) => updateFeature(f.feature_key, { is_active: val })}
                    disabled={savingId === f.feature_key}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Limit Management ────────────────────────────────────
function LimitManagement() {
  const [limits, setLimits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editValues, setEditValues] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchLimits = async () => {
    const { data } = await supabase.from("tier_limits").select("*").order("tier_id").order("limit_key");
    setLimits(data || []);
    const vals: Record<string, number> = {};
    (data || []).forEach((l) => { vals[l.id] = l.limit_value; });
    setEditValues(vals);
    setLoading(false);
  };

  useEffect(() => { fetchLimits(); }, []);

  const saveLimit = async (limit: any) => {
    setSavingId(limit.id);
    const newVal = editValues[limit.id];
    const { error } = await supabase.from("tier_limits").update({ limit_value: newVal }).eq("id", limit.id);
    if (error) toast.error(error.message);
    else toast.success(`Updated ${limit.limit_key} for ${limit.tier_id}`);
    setSavingId(null);
  };

  if (loading) return <Skeleton className="h-60" />;

  const tierGroups = ["free", "plus", "pro", "max"];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Limit Management</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {tierGroups.map((tier) => {
          const tierLimits = limits.filter((l) => l.tier_id === tier);
          if (!tierLimits.length) return null;
          return (
            <div key={tier}>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">{tier}</p>
              <div className="border rounded-md overflow-hidden">
                {tierLimits.map((l) => (
                  <div key={l.id} className="flex items-center gap-2 px-3 py-2 border-b last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{l.label || l.limit_key}</p>
                      <p className="text-[10px] text-muted-foreground">{l.limit_key} {editValues[l.id] === -1 && "· Unlimited"}</p>
                    </div>
                    <Input
                      type="number"
                      value={editValues[l.id] ?? l.limit_value}
                      onChange={(e) => setEditValues((prev) => ({ ...prev, [l.id]: parseInt(e.target.value) || 0 }))}
                      className="w-20 h-7 text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={savingId === l.id || editValues[l.id] === l.limit_value}
                      onClick={() => saveLimit(l)}
                    >
                      Save
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <p className="text-[10px] text-muted-foreground">Use -1 for unlimited</p>
      </CardContent>
    </Card>
  );
}

// ─── Main Tab ────────────────────────────────────────────
export function SubscriptionsTab() {
  return (
    <div className="space-y-4">
      <SubscriptionStats />

      <Tabs defaultValue="users">
        <TabsList className="w-full flex">
          <TabsTrigger value="users" className="flex-1 text-xs">Users</TabsTrigger>
          <TabsTrigger value="tiers" className="flex-1 text-xs">Tiers</TabsTrigger>
          <TabsTrigger value="features" className="flex-1 text-xs">Features</TabsTrigger>
          <TabsTrigger value="limits" className="flex-1 text-xs">Limits</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-3"><UserSubManagement /></TabsContent>
        <TabsContent value="tiers" className="mt-3"><TierOverview /></TabsContent>
        <TabsContent value="features" className="mt-3"><FeatureManagement /></TabsContent>
        <TabsContent value="limits" className="mt-3"><LimitManagement /></TabsContent>
      </Tabs>
    </div>
  );
}
