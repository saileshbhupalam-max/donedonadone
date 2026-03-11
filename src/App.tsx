import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PersonalityProvider } from "@/contexts/PersonalityContext";
import { FeatureFlagsProvider } from "@/hooks/useFeatureFlags";
import { SubscriptionProvider } from "@/hooks/useSubscription";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { InviteRedirect } from "@/components/InviteRedirect";
import { PersonalityLoader } from "@/components/ui/PersonalityLoader";
import { InstallPrompt } from "@/components/ui/InstallPrompt";

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
const Settings = lazy(() => import("./pages/Settings"));
const CompanyCreate = lazy(() => import("./pages/CompanyCreate"));
const CompanyProfile = lazy(() => import("./pages/CompanyProfile"));
const Pricing = lazy(() => import("./pages/Pricing"));
const CrossSpaceNetwork = lazy(() => import("./pages/CrossSpaceNetwork"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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

            {/* Protected routes */}
            <Route path="/onboarding" element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            } />
            <Route path="/home" element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            } />
            <Route path="/discover" element={
              <ProtectedRoute>
                <Discover />
              </ProtectedRoute>
            } />
            <Route path="/events" element={
              <ProtectedRoute>
                <Events />
              </ProtectedRoute>
            } />
            <Route path="/events/:id" element={
              <ProtectedRoute>
                <EventDetail />
              </ProtectedRoute>
            } />
            <Route path="/session/:eventId" element={
              <ProtectedRoute>
                <Session />
              </ProtectedRoute>
            } />
            <Route path="/prompts" element={
              <ProtectedRoute>
                <Prompts />
              </ProtectedRoute>
            } />
            <Route path="/me" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />
            <Route path="/profile/:id" element={
              <ProtectedRoute>
                <ProfileView />
              </ProtectedRoute>
            } />

            <Route path="/admin" element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            } />
            <Route path="/partners" element={
              <ProtectedRoute>
                <Partners />
              </ProtectedRoute>
            } />
            <Route path="/partner/apply" element={
              <ProtectedRoute>
                <PartnerApply />
              </ProtectedRoute>
            } />
            <Route path="/partner" element={
              <ProtectedRoute>
                <PartnerDashboard />
              </ProtectedRoute>
            } />
            <Route path="/map" element={
              <ProtectedRoute>
                <MapView />
              </ProtectedRoute>
            } />
            <Route path="/me/dna" element={
              <ProtectedRoute>
                <TasteGraphBuilder />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="/company/create" element={
              <ProtectedRoute>
                <CompanyCreate />
              </ProtectedRoute>
            } />
            <Route path="/company/:id" element={
              <ProtectedRoute>
                <CompanyProfile />
              </ProtectedRoute>
            } />
            <Route path="/pricing" element={
              <ProtectedRoute>
                <Pricing />
              </ProtectedRoute>
            } />
            <Route path="/network" element={
              <ProtectedRoute>
                <CrossSpaceNetwork />
              </ProtectedRoute>
            } />

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
  </QueryClientProvider>
);

export default App;
