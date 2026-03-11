import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// Mock dependencies
const mockTrackConversion = vi.fn();
const mockNavigate = vi.fn();
const mockToast = { info: vi.fn() };

vi.mock("@/lib/trackConversion", () => ({
  trackConversion: (...args: any[]) => mockTrackConversion(...args),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: "/pricing" }),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

vi.mock("sonner", () => ({
  toast: { info: (...args: any[]) => mockToast.info(...args) },
}));

vi.mock("@/hooks/usePageTitle", () => ({
  usePageTitle: vi.fn(),
}));

// Mock framer-motion to pass through
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock AppShell to just render children
vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: any) => <div data-testid="app-shell">{children}</div>,
}));

const TIERS = [
  { id: "free", name: "Explorer", description: "Start here", price_monthly: 0, price_yearly: 0, sort_order: 0, badge_color: "gray", is_active: true },
  { id: "plus", name: "Plus", description: "For regulars", price_monthly: 29900, price_yearly: 299000, sort_order: 10, badge_color: "blue", is_active: true },
  { id: "pro", name: "Pro", description: "Power features", price_monthly: 59900, price_yearly: 599000, sort_order: 20, badge_color: "purple", is_active: true },
  { id: "max", name: "Max", description: "Everything", price_monthly: 99900, price_yearly: 999000, sort_order: 30, badge_color: "gold", is_active: true },
];

const FEATURES = [
  { feature_key: "basic_discovery", label: "Basic Discovery", description: null, category: "discovery", min_tier_id: "free", sort_order: 1, is_active: true },
  { feature_key: "match_reasons", label: "Match Reasons", description: null, category: "matching", min_tier_id: "plus", sort_order: 10, is_active: true },
  { feature_key: "company_matching", label: "Company Matching", description: null, category: "company", min_tier_id: "pro", sort_order: 20, is_active: true },
  { feature_key: "cross_space_network", label: "Cross-Space Network", description: null, category: "community", min_tier_id: "max", sort_order: 30, is_active: true },
];

const LIMITS = [
  { tier_id: "free", limit_key: "connections_per_week", limit_value: 5, label: "Connections per week" },
  { tier_id: "plus", limit_key: "connections_per_week", limit_value: 20, label: "Connections per week" },
  { tier_id: "pro", limit_key: "connections_per_week", limit_value: 50, label: "Connections per week" },
  { tier_id: "max", limit_key: "connections_per_week", limit_value: -1, label: "Connections per week" },
];

const mockUseSubscription = vi.fn();

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => mockUseSubscription(),
}));

import Pricing from "@/pages/Pricing";

describe("Pricing page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockUseSubscription.mockReturnValue({
      tier: "free",
      allTiers: TIERS,
      allFeatures: FEATURES,
      allLimits: LIMITS,
      loading: false,
    });
  });

  it("renders all tier cards", () => {
    render(<Pricing />);
    expect(screen.getByText("Explorer")).toBeInTheDocument();
    expect(screen.getByText("Plus")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("Max")).toBeInTheDocument();
  });

  it("shows 'Current Plan' for the user's tier", () => {
    render(<Pricing />);
    expect(screen.getByText("Current Plan")).toBeInTheDocument();
  });

  it("shows 'Upgrade' buttons for higher tiers", () => {
    render(<Pricing />);
    const upgradeButtons = screen.getAllByText("Upgrade");
    expect(upgradeButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("shows 'Free' for the free tier price", () => {
    render(<Pricing />);
    expect(screen.getByText("Free")).toBeInTheDocument();
  });

  it("marks Plus as 'Most Popular'", () => {
    render(<Pricing />);
    expect(screen.getByText("Most Popular")).toBeInTheDocument();
  });

  it("tracks 'viewed_pricing' conversion on mount", () => {
    render(<Pricing />);
    expect(mockTrackConversion).toHaveBeenCalledWith("viewed_pricing");
  });

  describe("personalization from gate context", () => {
    it("shows default heading when no gate feature", () => {
      render(<Pricing />);
      expect(screen.getByText("Choose your plan")).toBeInTheDocument();
    });

    it("shows personalized heading when gate feature is in sessionStorage", () => {
      sessionStorage.setItem("last_gate_feature", "company_matching");
      render(<Pricing />);
      expect(screen.getByText("Unlock company matching")).toBeInTheDocument();
    });

    it("clears gate feature from sessionStorage after reading", () => {
      sessionStorage.setItem("last_gate_feature", "cross_space_network");
      render(<Pricing />);
      expect(sessionStorage.getItem("last_gate_feature")).toBeNull();
    });
  });

  describe("loading state", () => {
    it("shows skeleton loaders when loading", () => {
      mockUseSubscription.mockReturnValue({
        tier: "free",
        allTiers: [],
        allFeatures: [],
        allLimits: [],
        loading: true,
      });
      const { container } = render(<Pricing />);
      // Should not render tier cards
      expect(screen.queryByText("Explorer")).not.toBeInTheDocument();
    });
  });

  describe("unlimited limits display", () => {
    it("shows 'Unlimited' for limit_value of -1", () => {
      render(<Pricing />);
      const unlimitedTexts = screen.getAllByText(/Unlimited/);
      expect(unlimitedTexts.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("feature display across tiers", () => {
    it("shows check marks for features available in tier", () => {
      render(<Pricing />);
      // Basic Discovery (free-tier) should be available in all tiers
      const basicDiscovery = screen.getAllByText("Basic Discovery");
      expect(basicDiscovery.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("FAQ section", () => {
    it("renders FAQ questions", () => {
      render(<Pricing />);
      expect(screen.getByText("Can I cancel anytime?")).toBeInTheDocument();
      expect(screen.getByText("What's a Session Boost?")).toBeInTheDocument();
      expect(screen.getByText("Do I lose my data if I downgrade?")).toBeInTheDocument();
      expect(screen.getByText("Is there a team plan?")).toBeInTheDocument();
    });
  });

  describe("Session Boost card", () => {
    it("renders session boost section", () => {
      render(<Pricing />);
      expect(screen.getByText("Session Boost")).toBeInTheDocument();
      expect(screen.getByText("Get Session Boost")).toBeInTheDocument();
    });
  });

  describe("pro user sees different CTA", () => {
    it("pro user sees 'Current Plan' on Pro card and 'Upgrade' on Max", () => {
      mockUseSubscription.mockReturnValue({
        tier: "pro",
        allTiers: TIERS,
        allFeatures: FEATURES,
        allLimits: LIMITS,
        loading: false,
      });
      render(<Pricing />);
      expect(screen.getByText("Current Plan")).toBeInTheDocument();
      const upgradeButtons = screen.getAllByText("Upgrade");
      // Only Max should show Upgrade
      expect(upgradeButtons.length).toBe(1);
    });
  });
});
