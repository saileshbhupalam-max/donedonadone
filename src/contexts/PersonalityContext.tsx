import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import * as defaults from "@/lib/personality";

interface PersonalityConfig {
  [category: string]: Array<{ key: string | null; value: string; active: boolean; sort_order: number }>;
}

interface PersonalityContextType {
  config: PersonalityConfig;
  get: (category: string, key: string) => string;
  getList: (category: string) => string[];
  getRandom: (category: string) => string;
  loaded: boolean;
}

const PersonalityContext = createContext<PersonalityContextType | null>(null);

// Filter only string values from objects (exclude functions)
function stringOnly(obj: Record<string, any>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") result[k] = v;
  }
  return result;
}

// Default fallbacks map
const DEFAULT_MAP: Record<string, Record<string, string>> = {
  empty_states: stringOnly(defaults.EMPTY_STATES),
  errors: stringOnly(defaults.ERROR_STATES),
  confirmations: stringOnly(defaults.CONFIRMATIONS),
  celebrations: stringOnly(defaults.CELEBRATIONS),
  notifications: stringOnly(defaults.NOTIFICATION_COPY),
};

const DEFAULT_LISTS: Record<string, string[]> = {
  loading: defaults.LOADING_MESSAGES,
  refresh: defaults.REFRESH_MESSAGES,
};

export function PersonalityProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PersonalityConfig>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.from("personality_config").select("*").eq("active", true).order("sort_order")
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error || !data) { setLoaded(true); return; }
        const grouped: PersonalityConfig = {};
        data.forEach((row: any) => {
          if (!grouped[row.category]) grouped[row.category] = [];
          grouped[row.category].push({ key: row.key, value: row.value, active: row.active, sort_order: row.sort_order });
        });
        setConfig(grouped);
        setLoaded(true);
      });
    return () => { mounted = false; };
  }, []);

  const get = useCallback((category: string, key: string): string => {
    const items = config[category];
    if (items) {
      const found = items.find(i => i.key === key && i.active);
      if (found) return found.value;
    }
    // Fallback to defaults
    const def = DEFAULT_MAP[category];
    if (def && typeof def[key] === "string") return def[key];
    return "";
  }, [config]);

  const getList = useCallback((category: string): string[] => {
    const items = config[category];
    if (items && items.length > 0) return items.filter(i => i.active).map(i => i.value);
    return DEFAULT_LISTS[category] || [];
  }, [config]);

  const getRandom = useCallback((category: string): string => {
    const list = getList(category);
    return list[Math.floor(Math.random() * list.length)] || "";
  }, [getList]);

  return (
    <PersonalityContext.Provider value={{ config, get, getList, getRandom, loaded }}>
      {children}
    </PersonalityContext.Provider>
  );
}

export function usePersonality() {
  const ctx = useContext(PersonalityContext);
  if (!ctx) throw new Error("usePersonality must be used within PersonalityProvider");
  return ctx;
}
