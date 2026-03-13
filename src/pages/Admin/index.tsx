import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";

// ------- Navigation structure -------

interface NavItem {
  key: string;
  label: string;
  component: React.ReactNode;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { key: "analytics", label: "Analytics", component: <AdminAnalyticsCharts /> },
      { key: "overview", label: "Dashboard", component: <OverviewTab /> },
      { key: "engagement", label: "Engagement", component: <AnalyticsEngagementTab /> },
    ],
  },
  {
    id: "community",
    label: "Community",
    items: [
      { key: "members", label: "Members", component: <MembersTab /> },
      { key: "prompts", label: "Prompts", component: <PromptsTab /> },
      { key: "flags", label: "Flags", component: <FlagsTab /> },
      { key: "icebreakers", label: "Icebreakers", component: <IcebreakersTab /> },
      { key: "status", label: "Status Game", component: <StatusGameTab /> },
      { key: "notifs", label: "Notifications", component: <NotificationsTab /> },
    ],
  },
  {
    id: "sessions",
    label: "Sessions",
    items: [
      { key: "events", label: "Sessions", component: <EventsTab /> },
      { key: "subscriptions", label: "Subscriptions", component: <SubscriptionsTab /> },
    ],
  },
  {
    id: "partners",
    label: "Partners",
    items: [
      { key: "partners", label: "Partners", component: <PartnersTab /> },
      { key: "applications", label: "Applications", component: <PartnerApplicationsTab /> },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [
      { key: "settings", label: "General", component: <SettingsTab /> },
      { key: "feature-flags", label: "Feature Flags", component: <FeatureFlagsTab /> },
      { key: "chai", label: "Chai Settings", component: <ChaiSettingsTab /> },
      { key: "ai", label: "AI Config", component: <AIConfigTab /> },
      { key: "growth", label: "Growth", component: <GrowthTab /> },
    ],
  },
];

// Flat lookup for rendering content
const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

function groupForKey(key: string): string {
  return NAV_GROUPS.find((g) => g.items.some((i) => i.key === key))?.id ?? "overview";
}

// ------- Component -------

export default function Admin() {
  usePageTitle("Mission Control -- FocusClub");
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const isAdmin =
    profile?.user_type === "admin" || ADMIN_EMAILS.includes(user?.email || "");

  const [activeKey, setActiveKey] = useState("analytics");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    // Start with the group containing the default active key open
    const initial: Record<string, boolean> = {};
    NAV_GROUPS.forEach((g) => {
      initial[g.id] = g.id === groupForKey("analytics");
    });
    return initial;
  });

  // Mobile sidebar toggle
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate("/home");
    }
  }, [user, authLoading, navigate, isAdmin]);

  if (authLoading || !user || !isAdmin) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
          <Skeleton className="h-8 w-32" />
        </div>
      </AppShell>
    );
  }

  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleSelect = (key: string) => {
    setActiveKey(key);
    // Auto-open the parent group
    const gid = groupForKey(key);
    setOpenGroups((prev) => ({ ...prev, [gid]: true }));
    // Close mobile nav after selection
    setMobileNavOpen(false);
  };

  const activeItem = ALL_ITEMS.find((i) => i.key === activeKey);

  // Shared sidebar content used in both desktop and mobile
  const sidebarContent = (
    <nav className="space-y-1">
      {NAV_GROUPS.map((group) => (
        <Collapsible
          key={group.id}
          open={openGroups[group.id]}
          onOpenChange={() => toggleGroup(group.id)}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50">
            <span>{group.label}</span>
            {openGroups[group.id] ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-2">
            {group.items.map((item) => (
              <button
                key={item.key}
                onClick={() => handleSelect(item.key)}
                className={cn(
                  "block w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors",
                  activeKey === item.key
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {item.label}
              </button>
            ))}
          </CollapsibleContent>
        </Collapsible>
      ))}
    </nav>
  );

  return (
    <AppShell>
      <div className="px-4 py-4 max-w-7xl mx-auto">
        <h1 className="font-serif text-2xl text-foreground mb-4">Mission Control</h1>

        {/* ---- Mobile: toggle button + collapsible nav ---- */}
        <div className="md:hidden mb-4">
          <button
            onClick={() => setMobileNavOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-md border text-sm font-medium"
          >
            <span>{activeItem?.label ?? "Navigate"}</span>
            {mobileNavOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          {mobileNavOpen && (
            <div className="mt-2 border rounded-md p-2 bg-background">
              {sidebarContent}
            </div>
          )}
        </div>

        {/* ---- Desktop: sidebar + content ---- */}
        <div className="flex gap-6">
          {/* Sidebar - desktop only */}
          <aside className="hidden md:block w-48 flex-shrink-0 sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto">
            {sidebarContent}
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {activeItem?.component}
          </main>
        </div>
      </div>
    </AppShell>
  );
}
