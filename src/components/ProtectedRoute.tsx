import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { SuspensionNotice } from "@/components/SuspensionNotice";
import { parseISO } from "date-fns";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <h1 className="text-4xl tracking-tight animate-pulse">
          <span className="font-serif text-[#e07830]">Dana</span>
          <span className="font-sans font-bold">Done</span>
        </h1>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Check suspension — all suspension paths (admin + auto-escalation) now set suspended_until
  if (profile?.suspended_until) {
    const suspendedUntil = parseISO(profile.suspended_until);
    if (suspendedUntil > new Date()) {
      return <SuspensionNotice suspendedUntil={profile.suspended_until} reason={profile.suspension_reason} />;
    }
  }

  // If profile exists but onboarding not completed, redirect to onboarding
  // (unless already on onboarding page)
  if (profile && !profile.onboarding_completed && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  // If onboarding completed and trying to access onboarding, redirect to home
  if (profile?.onboarding_completed && location.pathname === "/onboarding") {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
}
