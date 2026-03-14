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

// ─── DEBUG: Capture URL state at module load time (before anything modifies it) ───
const DEBUG_INITIAL_URL = window.location.href;
const DEBUG_INITIAL_HASH = window.location.hash;
const DEBUG_INITIAL_SEARCH = window.location.search;
console.log("[auth:init] ═══════════════════════════════════════════");
console.log("[auth:init] URL at module load:", DEBUG_INITIAL_URL);
console.log("[auth:init] hash:", DEBUG_INITIAL_HASH || "(empty)");
console.log("[auth:init] search:", DEBUG_INITIAL_SEARCH || "(empty)");
console.log("[auth:init] has ?code=", new URLSearchParams(DEBUG_INITIAL_SEARCH).has("code"));
console.log("[auth:init] has #access_token=", DEBUG_INITIAL_HASH.includes("access_token"));
console.log("[auth:init] has #error=", DEBUG_INITIAL_HASH.includes("error"));

const HAD_AUTH_CALLBACK = new URLSearchParams(window.location.search).has("code");
console.log("[auth:init] HAD_AUTH_CALLBACK =", HAD_AUTH_CALLBACK);
console.log("[auth:init] ═══════════════════════════════════════════");

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const profileFetchId = useRef(0);
  const mountedRef = useRef(true);

  const fetchProfile = async (userId: string, fetchId: number) => {
    console.log("[auth:profile] fetching profile for", userId, "fetchId=", fetchId);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    console.log("[auth:profile] result:", data ? "found" : "null", "error:", error?.message || "none", "fetchId=", fetchId, "currentFetchId=", profileFetchId.current);
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
    console.log("[auth:effect] ═══ useEffect START ═══");
    console.log("[auth:effect] URL now:", window.location.href);

    // ─── 1. Set up auth state listener ───
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log("[auth:onChange] ───────────────────────────────");
        console.log("[auth:onChange] event:", event);
        console.log("[auth:onChange] session:", currentSession ? "present" : "null");
        console.log("[auth:onChange] user:", currentSession?.user?.id || "null");
        console.log("[auth:onChange] user email:", currentSession?.user?.email || "null");
        console.log("[auth:onChange] mounted:", mountedRef.current);
        if (!mountedRef.current) return;

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          const fetchId = ++profileFetchId.current;
          console.log("[auth:onChange] user present, fetching profile (setTimeout 0)");
          setTimeout(async () => {
            if (!mountedRef.current) return;
            await fetchProfile(currentSession.user.id, fetchId);
            if (mountedRef.current) {
              console.log("[auth:onChange] setting loading=false (after profile fetch)");
              setLoading(false);
            }
          }, 0);
        } else {
          setProfile(null);
          clearSentryUser();
          if (!HAD_AUTH_CALLBACK) {
            console.log("[auth:onChange] no session, no callback → loading=false");
            setLoading(false);
          } else {
            console.log("[auth:onChange] no session BUT HAD_AUTH_CALLBACK → staying loading=true");
          }
        }
      }
    );

    // ─── 2. Manual PKCE callback handling ───
    const callbackUrl = new URL(window.location.href);
    const code = callbackUrl.searchParams.get("code");
    console.log("[auth:pkce] code param:", code ? `"${code.substring(0, 20)}..."` : "null");

    if (code) {
      callbackUrl.searchParams.delete("code");
      window.history.replaceState(null, "", callbackUrl.pathname + callbackUrl.search);
      console.log("[auth:pkce] URL cleaned, calling exchangeCodeForSession...");

      supabase.auth.exchangeCodeForSession(code)
        .then((result) => {
          console.log("[auth:pkce] exchangeCodeForSession SUCCESS");
          console.log("[auth:pkce] session:", result.data.session ? "present" : "null");
          console.log("[auth:pkce] user:", result.data.session?.user?.id || "null");
          console.log("[auth:pkce] error:", result.error?.message || "none");
        })
        .catch((err) => {
          console.error("[auth:pkce] exchangeCodeForSession CATCH ERROR:", err);
          console.error("[auth:pkce] error type:", typeof err);
          console.error("[auth:pkce] error name:", err?.name);
          console.error("[auth:pkce] error message:", err?.message);
          console.error("[auth:pkce] error stack:", err?.stack);
          if (mountedRef.current) setLoading(false);
        });
    }

    // ─── 3. Clear stale implicit-flow hash fragments ───
    if (window.location.hash.includes("access_token") || window.location.hash.includes("error")) {
      console.log("[auth:hash] STALE hash fragment detected, clearing:", window.location.hash.substring(0, 100));
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }

    // ─── 4. Check existing session ───
    console.log("[auth:getSession] calling getSession()...");
    supabase.auth.getSession().then(({ data: { session: currentSession }, error }) => {
      console.log("[auth:getSession] ───────────────────────────────");
      console.log("[auth:getSession] session:", currentSession ? "present" : "null");
      console.log("[auth:getSession] user:", currentSession?.user?.id || "null");
      console.log("[auth:getSession] error:", error?.message || "none");
      console.log("[auth:getSession] mounted:", mountedRef.current);
      if (!mountedRef.current) return;

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        const fetchId = ++profileFetchId.current;
        console.log("[auth:getSession] user present, fetching profile");
        fetchProfile(currentSession.user.id, fetchId).then(() => {
          if (mountedRef.current) {
            console.log("[auth:getSession] setting loading=false (after profile)");
            setLoading(false);
          }
        });
      } else if (!HAD_AUTH_CALLBACK) {
        console.log("[auth:getSession] no session, no callback → loading=false");
        setLoading(false);
      } else {
        console.log("[auth:getSession] no session BUT HAD_AUTH_CALLBACK → staying loading=true");
      }
    });

    // ─── 5. Safety timeout ───
    let safetyTimeout: ReturnType<typeof setTimeout> | undefined;
    if (HAD_AUTH_CALLBACK) {
      console.log("[auth:safety] setting 10s safety timeout");
      safetyTimeout = setTimeout(() => {
        console.log("[auth:safety] ⚠️ SAFETY TIMEOUT FIRED — auth callback took >10s");
        if (mountedRef.current) setLoading(false);
      }, 10000);
    }

    console.log("[auth:effect] ═══ useEffect END (sync part) ═══");

    return () => {
      console.log("[auth:cleanup] unmounting AuthProvider");
      mountedRef.current = false;
      subscription.unsubscribe();
      if (safetyTimeout) clearTimeout(safetyTimeout);
    };
  }, []);

  const signOut = async () => {
    console.log("[auth:signOut] signing out");
    await supabase.auth.signOut();
    clearSentryUser();
    setUser(null);
    setSession(null);
    setProfile(null);
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
