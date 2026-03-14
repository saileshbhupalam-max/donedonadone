/* DESIGN: 4 nav items + conditional Network for Max tier. */

import { House, Compass, Calendar, User, Globe } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/hooks/useSubscription";

const baseItems = [
  { icon: House, label: "Home", path: "/home" },
  { icon: Compass, label: "Discover", path: "/discover" },
  { icon: Calendar, label: "Sessions", path: "/events" },
  { icon: User, label: "You", path: "/me" },
];

export function BottomNav() {
  const { hasFeature } = useSubscription();
  const showNetwork = hasFeature("cross_space_network");

  const navItems = showNetwork
    ? [baseItems[0], baseItems[1], { icon: Globe, label: "Network", path: "/network" }, baseItems[2], baseItems[3]]
    : baseItems;

  return (
    <nav aria-label="Main navigation" className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-t border-border" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 min-w-[44px] min-h-[44px] transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="text-xs font-medium">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
