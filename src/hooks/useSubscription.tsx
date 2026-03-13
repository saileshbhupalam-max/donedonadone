import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type TierId = "free" | "plus" | "pro" | "max";

interface TierInfo {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  sort_order: number;
  badge_color: string;
  is_active: boolean;
}

interface TierFeature {
  feature_key: string;
  label: string;
  description: string | null;
  category: string;
  min_tier_id: string;
  sort_order: number;
  is_active: boolean;
}

interface TierLimit {
  tier_id: string;
  limit_key: string;
  limit_value: number;
  label: string | null;
}

interface SubscriptionState {
  tier: TierId;
  tierName: string;
  tierOrder: number;
  badgeColor: string;
  isBoosted: boolean;
  boostExpiresAt: string | null;
  allTiers: TierInfo[];
  allFeatures: TierFeature[];
  allLimits: TierLimit[];
  loading: boolean;
  hasFeature: (key: string) => boolean;
  getLimit: (key: string) => number;
  refresh: () => Promise<void>;
}

const defaultState: SubscriptionState = {
  tier: "free",
  tierName: "Explorer",
  tierOrder: 0,
  badgeColor: "gray",
  isBoosted: false,
  boostExpiresAt: null,
  allTiers: [],
  allFeatures: [],
  allLimits: [],
  loading: true,
  hasFeature: () => false,
  getLimit: () => 0,
  refresh: async () => {},
};

const SubscriptionContext = createContext<SubscriptionState>(defaultState);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [tier, setTier] = useState<TierId>("free");
  const [tierName, setTierName] = useState("Explorer");
  const [tierOrder, setTierOrder] = useState(0);
  const [badgeColor, setBadgeColor] = useState("gray");
  const [isBoosted, setIsBoosted] = useState(false);
  const [boostExpiresAt, setBoostExpiresAt] = useState<string | null>(null);
  const [allTiers, setAllTiers] = useState<TierInfo[]>([]);
  const [allFeatures, setAllFeatures] = useState<TierFeature[]>([]);
  const [allLimits, setAllLimits] = useState<TierLimit[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const [tierRes, tiersRes, featuresRes, limitsRes] = await Promise.all([
      supabase.rpc("get_effective_tier", { p_user_id: user.id }),
      supabase.from("subscription_tiers").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("tier_features").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("tier_limits").select("tier_id, limit_key, limit_value, label"),
    ]);

    // Effective tier
    const effective = Array.isArray(tierRes.data) ? tierRes.data[0] : tierRes.data;
    if (effective) {
      setTier((effective.tier_id || "free") as TierId);
      setTierName(effective.tier_name || "Explorer");
      setTierOrder(effective.tier_sort_order ?? 0);
      setBadgeColor(effective.badge_color || "gray");
      setIsBoosted(effective.is_boosted ?? false);
      setBoostExpiresAt(effective.boost_expires_at || null);
    }

    setAllTiers((tiersRes.data || []) as TierInfo[]);
    setAllFeatures((featuresRes.data || []) as TierFeature[]);
    setAllLimits((limitsRes.data || []) as TierLimit[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime subscription updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`user_sub_changes:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_subscriptions",
          filter: `user_id=eq.${user.id}`,
        },
        () => { load(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, load]);

  const hasFeature = useCallback(
    (key: string): boolean => {
      const feature = allFeatures.find((f) => f.feature_key === key);
      if (!feature) return false;
      const minTier = allTiers.find((t) => t.id === feature.min_tier_id);
      if (!minTier) return false;
      return tierOrder >= minTier.sort_order;
    },
    [allFeatures, allTiers, tierOrder]
  );

  const getLimit = useCallback(
    (key: string): number => {
      const limit = allLimits.find((l) => l.tier_id === tier && l.limit_key === key);
      return limit?.limit_value ?? 0;
    },
    [allLimits, tier]
  );

  const value: SubscriptionState = {
    tier,
    tierName,
    tierOrder,
    badgeColor,
    isBoosted,
    boostExpiresAt,
    allTiers,
    allFeatures,
    allLimits,
    loading,
    hasFeature,
    getLimit,
    refresh: load,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
