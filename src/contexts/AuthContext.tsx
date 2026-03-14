import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { setSentryUser, clearSentryUser } from "@/lib/sentry";

type Profile = Tables<"profiles">;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Module-level check: with PKCE flow, the only valid OAuth callback indicator
// is ?code= in query params. Hash fragments (#access_token=) are stale from
// previous implicit-flow attempts and will be cleaned up, not processed.
const HAD_AUTH_CALLBACK = new URLSearchParams(window.location.search).has("code");

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // Prevent duplicate profile fetches from onAuthStateChange + getSession race
  const profileFetchId = useRef(0);
  const mountedRef = useRef(true);

  const fetchProfile = async (userId: string, fetchId: number) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    // Only apply if this is still the latest fetch and component is mounted
    if (mountedRef.current && fetchId === profileFetchId.current) {
      setProfile(data);
      if (data) setSentryUser(userId, undefined, data.user_type ?? undefined);
    }
    return data;
  };

  const refreshProfile = async () => {
    if (user) {
      const id = ++profileFetchId.current;
      await fetchProfile(user.id, id);
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, currentSession) => {
        if (!mountedRef.current) return;

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          const fetchId = ++profileFetchId.current;
          // setTimeout(0) avoids a Supabase-internal deadlock when
          // fetchProfile triggers another Supabase call inside a listener.
          setTimeout(async () => {
            if (!mountedRef.current) return;
            await fetchProfile(currentSession.user.id, fetchId);
            if (mountedRef.current) setLoading(false);
          }, 0);
        } else {
          setProfile(null);
          clearSentryUser();
          // During an OAuth callback, the code hasn't been exchanged yet when
          // the first onAuthStateChange fires (INITIAL_SESSION with null).
          // Keep loading=true — SIGNED_IN will follow with the real session.
          if (!HAD_AUTH_CALLBACK) {
            setLoading(false);
          }
        }
      }
    );

    // Manual PKCE callback handling: detectSessionInUrl is false (to prevent
    // the _getSessionFromURL crash), so we exchange the code ourselves.
    const callbackUrl = new URL(window.location.href);
    const code = callbackUrl.searchParams.get("code");
    if (code) {
      // Clean the URL immediately to prevent double-processing on re-render
      callbackUrl.searchParams.delete("code");
      window.history.replaceState(null, "", callbackUrl.pathname + callbackUrl.search);

      supabase.auth.exchangeCodeForSession(code).catch((err) => {
        console.error("[auth] PKCE code exchange failed:", err);
        if (mountedRef.current) setLoading(false);
      });
    }

    // Clear stale implicit-flow hash fragments from previous failed attempts
    if (window.location.hash.includes("access_token") || window.location.hash.includes("error")) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!mountedRef.current) return;

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        const fetchId = ++profileFetchId.current;
        fetchProfile(currentSession.user.id, fetchId).then(() => {
          if (mountedRef.current) setLoading(false);
        });
      } else if (!HAD_AUTH_CALLBACK) {
        // Normal page load with no session — safe to stop loading.
        setLoading(false);
      }
    });

    // Safety net: if an auth callback hangs, don't stay loading forever.
    let safetyTimeout: ReturnType<typeof setTimeout> | undefined;
    if (HAD_AUTH_CALLBACK) {
      safetyTimeout = setTimeout(() => {
        if (mountedRef.current) setLoading(false);
      }, 10000);
    }

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      if (safetyTimeout) clearTimeout(safetyTimeout);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    clearSentryUser();
    setUser(null);
    setSession(null);
    setProfile(null);
    // Clear all local state
    try {
      localStorage.removeItem("fc_ref");
      localStorage.removeItem("fc_theme");
    } catch { /* private browsing */ }
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
