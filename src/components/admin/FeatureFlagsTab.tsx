import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Flag } from "lucide-react";

interface FeatureFlag {
  id: string;
  flag_name: string;
  enabled: boolean;
  description: string | null;
  updated_at: string | null;
}

export function FeatureFlagsTab() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("feature_flags")
        .select("*")
        .order("flag_name");
      setFlags((data || []) as FeatureFlag[]);
      setLoading(false);
    })();
  }, []);

  const handleToggle = async (flag: FeatureFlag) => {
    setToggling(flag.id);
    const newEnabled = !flag.enabled;
    const { error } = await supabase
      .from("feature_flags")
      .update({ enabled: newEnabled, updated_at: new Date().toISOString() })
      .eq("id", flag.id);
    setToggling(null);

    if (error) {
      toast.error("Failed to update flag");
      return;
    }

    setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, enabled: newEnabled } : f));
    toast.success(`${flag.flag_name} ${newEnabled ? "enabled" : "disabled"}`);
  };

  if (loading) {
    return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Flag className="w-4 h-4 text-primary" />
        <h2 className="font-serif text-lg text-foreground">Feature Flags</h2>
      </div>
      <p className="text-xs text-muted-foreground">Toggle features on/off for all users. Changes take effect immediately.</p>

      <div className="space-y-2">
        {flags.map(flag => (
          <Card key={flag.id}>
            <CardContent className="p-3 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground font-mono">{flag.flag_name}</p>
                {flag.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{flag.description}</p>
                )}
              </div>
              <Switch
                checked={flag.enabled}
                onCheckedChange={() => handleToggle(flag)}
                disabled={toggling === flag.id}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {flags.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No feature flags configured.</p>
      )}
    </div>
  );
}
