import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface FeatureFlagsContextType {
  flags: Record<string, boolean>;
  loading: boolean;
  isEnabled: (flagName: string) => boolean;
}

// Module-level cache
let cachedFlags: Record<string, boolean> | null = null;
let cachePromise: Promise<void> | null = null;

const FeatureFlagsContext = createContext<FeatureFlagsContextType>({
  flags: {},
  loading: true,
  isEnabled: () => false,
});

async function loadFlags(): Promise<Record<string, boolean>> {
  if (cachedFlags) return cachedFlags;
  const { data } = await supabase.from("feature_flags").select("flag_name, enabled");
  const map: Record<string, boolean> = {};
  (data || []).forEach((f: any) => { map[f.flag_name] = f.enabled; });
  cachedFlags = map;
  return map;
}

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<Record<string, boolean>>(cachedFlags || {});
  const [loading, setLoading] = useState(!cachedFlags);

  useEffect(() => {
    if (cachedFlags) {
      setFlags(cachedFlags);
      setLoading(false);
      return;
    }
    if (!cachePromise) {
      cachePromise = loadFlags().then(f => {
        setFlags(f);
        setLoading(false);
      });
    } else {
      cachePromise.then(() => {
        setFlags(cachedFlags || {});
        setLoading(false);
      });
    }
  }, []);

  const isEnabled = useCallback((flagName: string) => {
    return flags[flagName] === true;
  }, [flags]);

  return (
    <FeatureFlagsContext.Provider value={{ flags, loading, isEnabled }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}
