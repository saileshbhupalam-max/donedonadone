import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type UserLevel = "new_user" | "explorer" | "regular" | "core" | "power_user";
export type UserState = "offline" | "checked_in" | "available" | "in_session";

interface ActiveCheckIn {
  id: string;
  location_id: string | null;
  status: string;
  mode: string;
  note: string | null;
  checked_in_at: string;
  latitude?: number | null;
  longitude?: number | null;
  location_name?: string;
  location_type?: string;
}

interface UserContextReturn {
  level: UserLevel;
  currentState: UserState;
  currentMode: "work" | "play" | "open" | null;
  currentLocation: { id: string; name: string; locationType: string } | null;
  activeCheckIn: ActiveCheckIn | null;
  dnaComplete: number;
  workDnaComplete: number;
  playDnaComplete: number;
  loading: boolean;
  refreshCheckIn: () => Promise<void>;
}

function getLevel(eventsAttended: number): UserLevel {
  if (eventsAttended === 0) return "new_user";
  if (eventsAttended <= 2) return "explorer";
  if (eventsAttended <= 5) return "regular";
  if (eventsAttended <= 10) return "core";
  return "power_user";
}

export const LEVEL_ORDER: Record<UserLevel, number> = {
  new_user: 0,
  explorer: 1,
  regular: 2,
  core: 3,
  power_user: 4,
};

export function useUserContext(): UserContextReturn {
  const { user, profile } = useAuth();
  const [activeCheckIn, setActiveCheckIn] = useState<ActiveCheckIn | null>(null);
  const [workDnaComplete, setWorkDnaComplete] = useState(0);
  const [playDnaComplete, setPlayDnaComplete] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCheckIn = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("check_ins")
      .select("id, location_id, status, mode, note, checked_in_at, latitude, longitude")
      .eq("user_id", user.id)
      .is("checked_out_at", null)
      .order("checked_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data && data.location_id) {
      const { data: loc } = await supabase
        .from("locations")
        .select("name, location_type")
        .eq("id", data.location_id)
        .single();
      if (loc) {
        const enriched: ActiveCheckIn = { ...data, location_name: loc.name, location_type: loc.location_type };
        setActiveCheckIn(enriched);
        return;
      }
    }
    setActiveCheckIn(data || null);
  };

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const fetchAll = async () => {
      // Fetch taste graph
      const { data: tg } = await supabase
        .from("taste_graph")
        .select("work_profile_complete, play_profile_complete")
        .eq("user_id", user.id)
        .maybeSingle();

      if (tg) {
        setWorkDnaComplete(Number(tg.work_profile_complete || 0));
        setPlayDnaComplete(Number(tg.play_profile_complete || 0));
      }

      await fetchCheckIn();
      setLoading(false);
    };

    fetchAll();

    // Realtime subscription for check-ins (auto-expire detection)
    const channel = supabase
      .channel(`check_ins_${user.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "check_ins",
        filter: `user_id=eq.${user.id}`,
      }, () => {
        fetchCheckIn();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const level = useMemo(() => getLevel(profile?.events_attended || 0), [profile?.events_attended]);

  const currentState: UserState = useMemo(() => {
    if (!activeCheckIn) return "offline";
    if (activeCheckIn.status === "in_session") return "in_session";
    if (activeCheckIn.status === "available") return "available";
    return "checked_in";
  }, [activeCheckIn]);

  const currentMode = activeCheckIn ? (activeCheckIn.mode as "work" | "play" | "open") : null;

  const currentLocation = activeCheckIn?.location_id && activeCheckIn.location_name
    ? { id: activeCheckIn.location_id, name: activeCheckIn.location_name, locationType: activeCheckIn.location_type || "other" }
    : null;

  const dnaComplete = workDnaComplete; // Until play_mode is enabled

  return {
    level,
    currentState,
    currentMode,
    currentLocation,
    activeCheckIn,
    dnaComplete,
    workDnaComplete,
    playDnaComplete,
    loading,
    refreshCheckIn: fetchCheckIn,
  };
}
