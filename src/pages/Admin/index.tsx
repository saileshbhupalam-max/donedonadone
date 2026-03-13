import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/hooks/usePageTitle";
import { ADMIN_EMAILS } from "./constants";
import { OverviewTab } from "./OverviewTab";
import { MembersTab } from "./MembersTab";
import { PromptsTab } from "./PromptsTab";
import { EventsTab } from "./EventsTab";
import { SettingsTab } from "./SettingsTab";
import { AdminAnalyticsCharts } from "@/components/admin/AdminAnalytics";
import { StatusGameTab } from "@/components/admin/StatusGameTab";
import { IcebreakersTab } from "@/components/admin/IcebreakersTab";
import { PartnersTab } from "@/components/admin/PartnersTab";
import { PartnerApplicationsTab } from "@/components/admin/PartnerApplicationsTab";
import { GrowthTab } from "@/components/admin/GrowthTab";
import { ChaiSettingsTab } from "@/components/admin/ChaiSettingsTab";
import { FlagsTab } from "@/components/admin/FlagsTab";
import { FeatureFlagsTab } from "@/components/admin/FeatureFlagsTab";
import { SubscriptionsTab } from "@/components/admin/SubscriptionsTab";
import { AIConfigTab } from "@/components/admin/AIConfigTab";
import { AnalyticsEngagementTab } from "@/components/admin/AnalyticsEngagementTab";
import { NotificationsTab } from "@/components/admin/NotificationsTab";

export default function Admin() {
  usePageTitle("Mission Control -- FocusClub");
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const isAdmin = profile?.user_type === 'admin' || ADMIN_EMAILS.includes(user?.email || '');

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate("/home");
    }
  }, [user, authLoading, navigate, isAdmin]);

  if (authLoading || !user || !isAdmin) {
    return <AppShell><div className="flex items-center justify-center h-[calc(100vh-8rem)]"><Skeleton className="h-8 w-32" /></div></AppShell>;
  }

  return (
    <AppShell>
      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        <h1 className="font-serif text-2xl text-foreground">Mission Control</h1>

        <Tabs defaultValue="analytics">
          <TabsList className="w-full flex">
            <TabsTrigger value="analytics" className="flex-1 text-xs">Analytics</TabsTrigger>
            <TabsTrigger value="overview" className="flex-1 text-xs">Overview</TabsTrigger>
            <TabsTrigger value="members" className="flex-1 text-xs">Members</TabsTrigger>
            <TabsTrigger value="status" className="flex-1 text-xs">Status</TabsTrigger>
            <TabsTrigger value="icebreakers" className="flex-1 text-xs">Icebreakers</TabsTrigger>
            <TabsTrigger value="partners" className="flex-1 text-xs">Partners</TabsTrigger>
            <TabsTrigger value="applications" className="flex-1 text-xs">Applications</TabsTrigger>
            <TabsTrigger value="growth" className="flex-1 text-xs">Growth</TabsTrigger>
             <TabsTrigger value="flags" className="flex-1 text-xs">Flags</TabsTrigger>
            <TabsTrigger value="feature-flags" className="flex-1 text-xs">Feature Flags</TabsTrigger>
            <TabsTrigger value="chai" className="flex-1 text-xs">Chai</TabsTrigger>
            <TabsTrigger value="subscriptions" className="flex-1 text-xs">Subs</TabsTrigger>
            <TabsTrigger value="ai" className="flex-1 text-xs">AI</TabsTrigger>
            <TabsTrigger value="engagement" className="flex-1 text-xs">Engagement</TabsTrigger>
            <TabsTrigger value="notifs" className="flex-1 text-xs">Notifs</TabsTrigger>
            <TabsTrigger value="prompts" className="flex-1 text-xs">Prompts</TabsTrigger>
            <TabsTrigger value="events" className="flex-1 text-xs">Sessions</TabsTrigger>
            <TabsTrigger value="settings" className="flex-1 text-xs">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="mt-4"><AdminAnalyticsCharts /></TabsContent>
          <TabsContent value="overview" className="mt-4"><OverviewTab /></TabsContent>
          <TabsContent value="members" className="mt-4"><MembersTab /></TabsContent>
          <TabsContent value="status" className="mt-4"><StatusGameTab /></TabsContent>
          <TabsContent value="icebreakers" className="mt-4"><IcebreakersTab /></TabsContent>
          <TabsContent value="partners" className="mt-4"><PartnersTab /></TabsContent>
          <TabsContent value="applications" className="mt-4"><PartnerApplicationsTab /></TabsContent>
          <TabsContent value="growth" className="mt-4"><GrowthTab /></TabsContent>
          <TabsContent value="flags" className="mt-4"><FlagsTab /></TabsContent>
          <TabsContent value="feature-flags" className="mt-4"><FeatureFlagsTab /></TabsContent>
          <TabsContent value="chai" className="mt-4"><ChaiSettingsTab /></TabsContent>
          <TabsContent value="subscriptions" className="mt-4"><SubscriptionsTab /></TabsContent>
          <TabsContent value="ai" className="mt-4"><AIConfigTab /></TabsContent>
          <TabsContent value="engagement" className="mt-4"><AnalyticsEngagementTab /></TabsContent>
          <TabsContent value="notifs" className="mt-4"><NotificationsTab /></TabsContent>
          <TabsContent value="prompts" className="mt-4"><PromptsTab /></TabsContent>
          <TabsContent value="events" className="mt-4"><EventsTab /></TabsContent>
          <TabsContent value="settings" className="mt-4"><SettingsTab /></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
