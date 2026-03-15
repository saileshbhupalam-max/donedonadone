import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PersonalityProvider } from "@/contexts/PersonalityContext";
import { FeatureFlagsProvider } from "@/hooks/useFeatureFlags";
import { SubscriptionProvider } from "@/hooks/useSubscription";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { InviteRedirect } from "@/components/InviteRedirect";
import { PersonalityLoader } from "@/components/ui/PersonalityLoader";
import { InstallPrompt } from "@/components/ui/InstallPrompt";
import { usePageTracking } from "@/hooks/usePageTracking";

/** Invisible component that fires page_view on every route change. */
function PageTracker() {
  usePageTracking();
  return null;
}

/** Wraps a page in both auth protection and a route-level error boundary. */
function ProtectedPage({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <RouteErrorBoundary>
        {children}
      </RouteErrorBoundary>
    </ProtectedRoute>
  );
}

// Lazy-loaded page components for code splitting
const Index = lazy(() => import("./pages/Index"));
const Home = lazy(() => import("./pages/Home"));
const Discover = lazy(() => import("./pages/Discover"));
const Events = lazy(() => import("./pages/Events"));
const EventDetail = lazy(() => import("./pages/EventDetail"));
const Session = lazy(() => import("./pages/Session"));
const Prompts = lazy(() => import("./pages/Prompts"));
const Profile = lazy(() => import("./pages/Profile"));
const ProfileView = lazy(() => import("./pages/ProfileView"));
const Admin = lazy(() => import("./pages/Admin"));
const Partners = lazy(() => import("./pages/Partners"));
const PartnerApply = lazy(() => import("./pages/PartnerApply"));
const PartnerDashboard = lazy(() => import("./pages/PartnerDashboard"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const MapView = lazy(() => import("./pages/MapView"));
const TasteGraphBuilder = lazy(() => import("./pages/TasteGraphBuilder"));
const Settings = lazy(() => import("./pages/Settings").then(mod => {
  console.log("[Settings lazy] module loaded:", mod);
  console.log("[Settings lazy] default export:", mod.default, "typeof:", typeof mod.default);
  if (typeof mod.default !== "function") {
    console.error("[Settings lazy] DEFAULT IS NOT A FUNCTION! It is:", typeof mod.default, mod.default);
  }
  return mod;
}).catch(err => {
  console.error("[Settings lazy] CHUNK FAILED TO LOAD:", err);
  throw err;
}));
const CompanyCreate = lazy(() => import("./pages/CompanyCreate"));
const CompanyProfile = lazy(() => import("./pages/CompanyProfile"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Companies = lazy(() => import("./pages/Companies"));
const Needs = lazy(() => import("./pages/Needs"));
const Credits = lazy(() => import("./pages/Credits"));
const SpaceInsights = lazy(() => import("./pages/SpaceInsights"));
const SpaceLive = lazy(() => import("./pages/SpaceLive"));
const CrossSpaceNetwork = lazy(() => import("./pages/CrossSpaceNetwork"));
const NominateVenue = lazy(() => import("./pages/NominateVenue"));
const NotFound = lazy(() => import("./pages/NotFound"));

const App = () => (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <PageTracker />
        <AuthProvider>
          <FeatureFlagsProvider>
          <SubscriptionProvider>
          <PersonalityProvider>
          <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-screen gap-3">
              <PersonalityLoader />
            </div>
          }>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/invite/:code" element={<InviteRedirect />} />

            {/* Protected routes — each wrapped in ProtectedPage (auth + error boundary) */}
            <Route path="/onboarding" element={
              <ProtectedPage><Onboarding /></ProtectedPage>
            } />
            <Route path="/home" element={
              <ProtectedPage><Home /></ProtectedPage>
            } />
            <Route path="/discover" element={
              <ProtectedPage><Discover /></ProtectedPage>
            } />
            <Route path="/events" element={
              <ProtectedPage><Events /></ProtectedPage>
            } />
            <Route path="/events/:id" element={
              <ProtectedPage><EventDetail /></ProtectedPage>
            } />
            <Route path="/session/:eventId" element={
              <ProtectedPage><Session /></ProtectedPage>
            } />
            <Route path="/prompts" element={
              <ProtectedPage><Prompts /></ProtectedPage>
            } />
            <Route path="/me" element={
              <ProtectedPage><Profile /></ProtectedPage>
            } />
            <Route path="/profile/:id" element={
              <ProtectedPage><ProfileView /></ProtectedPage>
            } />
            <Route path="/admin" element={
              <ProtectedPage><Admin /></ProtectedPage>
            } />
            <Route path="/partners" element={
              <ProtectedPage><Partners /></ProtectedPage>
            } />
            <Route path="/partner/apply" element={
              <ProtectedPage><PartnerApply /></ProtectedPage>
            } />
            <Route path="/partner" element={
              <ProtectedPage><PartnerDashboard /></ProtectedPage>
            } />
            <Route path="/map" element={
              <ProtectedPage><MapView /></ProtectedPage>
            } />
            <Route path="/me/dna" element={
              <ProtectedPage><TasteGraphBuilder /></ProtectedPage>
            } />
            <Route path="/settings" element={
              <ProtectedPage><Settings /></ProtectedPage>
            } />
            <Route path="/company/create" element={
              <ProtectedPage><CompanyCreate /></ProtectedPage>
            } />
            <Route path="/company/:id" element={
              <ProtectedPage><CompanyProfile /></ProtectedPage>
            } />
            <Route path="/pricing" element={
              <ProtectedPage><Pricing /></ProtectedPage>
            } />
            <Route path="/companies" element={
              <ProtectedPage><Companies /></ProtectedPage>
            } />
            <Route path="/needs" element={
              <ProtectedPage><Needs /></ProtectedPage>
            } />
            <Route path="/credits" element={
              <ProtectedPage><Credits /></ProtectedPage>
            } />
            <Route path="/network" element={
              <ProtectedPage><CrossSpaceNetwork /></ProtectedPage>
            } />
            <Route path="/nominate" element={
              <ProtectedPage><NominateVenue /></ProtectedPage>
            } />

            {/* Public routes (no auth required) */}
            <Route path="/space/:id/insights" element={<SpaceInsights />} />
            <Route path="/space/:id/live" element={<SpaceLive />} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          <InstallPrompt />
          </PersonalityProvider>
          </SubscriptionProvider>
          </FeatureFlagsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
);

export default App;
