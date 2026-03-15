/**
 * Reusable map/list view toggle — provides a consistent swap pattern
 * across any screen that has location-aware content.
 *
 * Usage:
 *   const [view, setView] = useState<"list" | "map">("list");
 *   <MapSwapToggle view={view} onToggle={setView} />
 */
import { Map, List } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  view: "list" | "map";
  onToggle: (view: "list" | "map") => void;
  className?: string;
}

export function MapSwapToggle({ view, onToggle, className }: Props) {
  return (
    <div className={cn("flex bg-muted rounded-lg p-0.5", className)}>
      <button
        onClick={() => onToggle("list")}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
          view === "list"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <List className="w-3.5 h-3.5" />
        List
      </button>
      <button
        onClick={() => onToggle("map")}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
          view === "map"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Map className="w-3.5 h-3.5" />
        Map
      </button>
    </div>
  );
}
