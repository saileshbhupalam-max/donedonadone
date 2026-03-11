import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Connection {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  connection_type: string;
  strength: number | null;
}

export function useConnections() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) return;

    const { data: conns } = await supabase
      .from("connections")
      .select("id, user_a, user_b, connection_type, strength")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);

    if (!conns || conns.length === 0) {
      setConnections([]);
      setLoading(false);
      return;
    }

    const otherIds = conns.map((c) => (c.user_a === user.id ? c.user_b : c.user_a));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", otherIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    setConnections(
      conns.map((c) => {
        const otherId = c.user_a === user.id ? c.user_b : c.user_a;
        const p = profileMap.get(otherId);
        return {
          id: c.id,
          user_id: otherId,
          display_name: p?.display_name || null,
          avatar_url: p?.avatar_url || null,
          connection_type: c.connection_type,
          strength: c.strength ? Number(c.strength) : null,
        };
      })
    );
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  return { connections, loading, refetch: fetch };
}
