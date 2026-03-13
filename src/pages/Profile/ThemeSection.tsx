import { useTheme } from "@/hooks/useTheme";
import { Sun, Moon, Monitor } from "lucide-react";

// ─── Theme Section ──────────────────────────────────────
export function ThemeSection() {
  const { theme, setTheme } = useTheme();
  const options = [
    { value: "light" as const, icon: Sun, label: "Light" },
    { value: "dark" as const, icon: Moon, label: "Dark" },
    { value: "system" as const, icon: Monitor, label: "System" },
  ];
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-foreground">Theme</h3>
      <div className="grid grid-cols-3 gap-2">
        {options.map(o => (
          <button key={o.value} onClick={() => setTheme(o.value)}
            className={`rounded-xl border p-3 text-center transition-all ${theme === o.value ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}>
            <o.icon className="w-5 h-5 mx-auto text-foreground" />
            <p className="text-xs font-medium text-foreground mt-1">{o.label}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
