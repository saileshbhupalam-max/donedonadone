import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface FeatureFlagsContextType {
  flags: Record<string, boolean>;
  loading: boolean;
  isEnabled: (flagName: string) => boolean;
}

// Module-level cache (data only — no React setters)
let cachedFlags: Record<string, boolean> | null = null;
let cachePromise: Promise<Record<string, boolean>> | null = null;

const FeatureFlagsContext = createContext<FeatureFlagsContextType>({
  flags: {},
  loading: true,
  isEnabled: () => false,
});

function loadFlags(): Promise<Record<string, boolean>> {
  if (cachedFlags) return Promise.resolve(cachedFlags);
  if (!cachePromise) {
    cachePromise = supabase.from("feature_flags").select("flag_name, enabled")
      .then(({ data }) => {
        const map: Record<string, boolean> = {};
        (data || []).forEach((f: any) => { map[f.flag_name] = f.enabled; });
        cachedFlags = map;
        return map;
      });
  }
  return cachePromise;
}

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<Record<string, boolean>>(cachedFlags || {});
  const [loading, setLoading] = useState(!cachedFlags);

  useEffect(() => {
    let mounted = true;
    loadFlags().then((f) => {
      if (mounted) {
        setFlags(f);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
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
