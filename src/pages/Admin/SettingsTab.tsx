import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export function SettingsTab() {
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.from("app_settings").select("*").order("key").then(({ data }) => {
      setSettings(data || []);
      setLoading(false);
    });
  }, []);

  const handleSave = async (key: string) => {
    const raw = edits[key];
    if (raw === undefined) return;
    try {
      const setting = settings.find((s) => s.key === key);
      const newValue = { ...setting.value, value: isNaN(Number(raw)) ? (raw === "true" ? true : raw === "false" ? false : raw) : Number(raw) };
      const { error } = await supabase.from("app_settings").update({ value: newValue, updated_at: new Date().toISOString() }).eq("key", key);
      if (error) throw error;
      setSettings((prev) => prev.map((s) => s.key === key ? { ...s, value: newValue } : s));
      setEdits((prev) => { const n = { ...prev }; delete n[key]; return n; });
      toast.success(`Setting "${key}" updated`);
    } catch (error) {
      console.error("[SaveSetting]", error);
      toast.error("Something went wrong saving the setting.");
    }
  };

  if (loading) return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;

  return (
    <div className="space-y-3">
      {settings.map((s) => (
        <Card key={s.key}>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">{s.key}</p>
            <p className="text-xs text-muted-foreground">{s.value?.description}</p>
            <div className="flex gap-2">
              <Input
                value={edits[s.key] ?? String(s.value?.value ?? "")}
                onChange={(e) => setEdits((prev) => ({ ...prev, [s.key]: e.target.value }))}
                className="flex-1"
              />
              <Button size="sm" onClick={() => handleSave(s.key)} disabled={edits[s.key] === undefined}>Save</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
