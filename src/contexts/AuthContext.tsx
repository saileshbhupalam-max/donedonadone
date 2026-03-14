import { createContext, useContext, useEffect, useState, ReactNode } from "react";
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    setProfile(data);
    if (data) setSentryUser(userId, undefined, data.user_type ?? undefined);
    return data;
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    // Detect if returning from an OAuth callback — tokens may still be
    // processing so we must NOT set loading=false until auth resolves.
    // Implicit flow puts tokens in the hash; PKCE flow puts a code in the query.
    const isAuthCallback =
      window.location.hash.includes("access_token") ||
      window.location.hash.includes("error") ||
      new URLSearchParams(window.location.search).has("code");

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          // setTimeout(0) avoids a Supabase-internal deadlock when
          // fetchProfile triggers another Supabase call inside a listener.
          setTimeout(async () => {
            await fetchProfile(currentSession.user.id);
            setLoading(false);
          }, 0);
        } else {
          setProfile(null);
          clearSentryUser();
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        fetchProfile(currentSession.user.id).then(() => setLoading(false));
      } else if (!isAuthCallback) {
        // Normal page load with no session — safe to stop loading.
        // During an OAuth callback, tokens may not be parsed yet so
        // getSession() returns null; onAuthStateChange will fire
        // SIGNED_IN shortly and set loading=false then.
        setLoading(false);
      }
    });

    // Safety net: if an auth callback hangs, don't stay loading forever.
    let safetyTimeout: ReturnType<typeof setTimeout> | undefined;
    if (isAuthCallback) {
      safetyTimeout = setTimeout(() => setLoading(false), 10000);
    }

    return () => {
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
