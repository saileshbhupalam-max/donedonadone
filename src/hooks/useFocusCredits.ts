import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getBalance, getTodayEarnings } from "@/lib/focusCredits";

export function useFocusCredits() {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    const [b, e] = await Promise.all([
      getBalance(user.id),
      getTodayEarnings(user.id),
    ]);
    setBalance(b);
    setTodayEarnings(e);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    let mounted = true;
    if (!user) { setLoading(false); return; }
    Promise.all([getBalance(user.id), getTodayEarnings(user.id)]).then(([b, e]) => {
      if (mounted) { setBalance(b); setTodayEarnings(e); setLoading(false); }
    });
    return () => { mounted = false; };
  }, [user]);

  return { balance, todayEarnings, loading, refresh };
}
