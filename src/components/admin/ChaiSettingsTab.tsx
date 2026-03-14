import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, RotateCcw, Eye } from "lucide-react";
import { toast } from "sonner";
import * as defaults from "@/lib/personality";

interface ConfigRow {
  id: string;
  category: string;
  key: string | null;
  value: string;
  sort_order: number | null;
  active: boolean | null;
}

const CATEGORIES = [
  { value: "loading", label: "Loading Messages", type: "list" },
  { value: "refresh", label: "Pull-to-Refresh", type: "list" },
  { value: "empty_states", label: "Empty States", type: "kv" },
  { value: "errors", label: "Error States", type: "kv" },
  { value: "confirmations", label: "Confirmations", type: "kv" },
  { value: "greetings_morning", label: "Greetings — Morning", type: "list" },
  { value: "greetings_afternoon", label: "Greetings — Afternoon", type: "list" },
  { value: "greetings_evening", label: "Greetings — Evening", type: "list" },
  { value: "greetings_night", label: "Greetings — Night", type: "list" },
  { value: "greetings_special", label: "Special Greetings", type: "kv" },
  { value: "celebrations", label: "Celebration Copy", type: "kv" },
  { value: "notifications", label: "Notification Templates", type: "kv" },
  { value: "easter_eggs", label: "Easter Eggs", type: "kv" },
];

// Hardcoded defaults for seeding
const SEED_DATA: Record<string, Array<{ key: string | null; value: string }>> = {
  loading: defaults.LOADING_MESSAGES.map(v => ({ key: null, value: v })),
  refresh: defaults.REFRESH_MESSAGES.map(v => ({ key: null, value: v })),
  empty_states: Object.entries(defaults.EMPTY_STATES)
    .filter(([, v]) => typeof v === "string")
    .map(([k, v]) => ({ key: k, value: v as string })),
  errors: Object.entries(defaults.ERROR_STATES).map(([k, v]) => ({ key: k, value: v })),
  confirmations: Object.entries(defaults.CONFIRMATIONS)
    .filter(([, v]) => typeof v === "string")
    .map(([k, v]) => ({ key: k, value: v as string })),
  celebrations: Object.entries(defaults.CELEBRATIONS)
    .filter(([, v]) => typeof v === "string")
    .map(([k, v]) => ({ key: k, value: v as string })),
};

export function ChaiSettingsTab() {
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("loading");

  const fetchAll = async () => {
    const { data } = await supabase.from("personality_config").select("*").order("sort_order");
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const catRows = rows.filter(r => r.category === activeTab);
  const catDef = CATEGORIES.find(c => c.value === activeTab);

  const handleSave = async (row: ConfigRow) => {
    const { error } = await supabase.from("personality_config").update({
      value: row.value, active: row.active, sort_order: row.sort_order, key: row.key,
    }).eq("id", row.id);
    if (error) toast.error("Failed to save");
    else toast.success("Saved");
  };

  const handleAdd = async () => {
    const maxOrder = catRows.length > 0 ? Math.max(...catRows.map(r => r.sort_order ?? 0)) + 1 : 0;
    const { error } = await supabase.from("personality_config").insert({
      category: activeTab,
      key: catDef?.type === "kv" ? "new_key" : null,
      value: "New message",
      sort_order: maxOrder,
      active: true,
    });
    if (!error) fetchAll();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("personality_config").delete().eq("id", id);
    fetchAll();
  };

  const handleSeedCategory = async () => {
    const seeds = SEED_DATA[activeTab];
    if (!seeds || seeds.length === 0) { toast("No defaults available for this category"); return; }
    const inserts = seeds.map((s, i) => ({
      category: activeTab, key: s.key, value: s.value, sort_order: i, active: true,
    }));
    const { error } = await supabase.from("personality_config").insert(inserts);
    if (error) toast.error("Seed failed");
    else { toast.success(`Seeded ${inserts.length} messages`); fetchAll(); }
  };

  const handleTest = (value: string) => {
    const rendered = value
      .replace(/\[name\]/g, "Aarav")
      .replace(/\[venue\]/g, "Third Wave Coffee")
      .replace(/\[day\]/g, "Saturday")
      .replace(/\[X\]/g, "5");
    toast(rendered, { duration: 4000 });
  };

  const updateRow = (id: string, updates: Partial<ConfigRow>) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  if (loading) return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-lg text-foreground">Chai — The Voice</h2>
          <p className="text-xs text-muted-foreground">Edit every word DanaDone says. The poet in the machine.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {CATEGORIES.map(c => (
            <TabsTrigger key={c.value} value={c.value} className="text-[10px] px-2 py-1">
              {c.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORIES.map(cat => (
          <TabsContent key={cat.value} value={cat.value} className="mt-4 space-y-3">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleAdd}><Plus className="w-3.5 h-3.5" /> Add</Button>
              {SEED_DATA[cat.value] && catRows.length === 0 && (
                <Button size="sm" variant="outline" onClick={handleSeedCategory}>
                  <RotateCcw className="w-3.5 h-3.5" /> Seed Defaults
                </Button>
              )}
            </div>

            {catRows.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No custom messages yet. Using hardcoded defaults. Click "Seed Defaults" to import them for editing.
              </p>
            )}

            {catRows.map(row => (
              <Card key={row.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    {cat.type === "kv" && (
                      <Input
                        value={row.key || ""}
                        onChange={e => updateRow(row.id, { key: e.target.value })}
                        placeholder="Key"
                        className="w-32 text-xs"
                      />
                    )}
                    <div className="flex items-center gap-2 ml-auto">
                      <Switch
                        checked={row.active ?? false}
                        onCheckedChange={v => { updateRow(row.id, { active: v }); }}
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleTest(row.value)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(row.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    value={row.value}
                    onChange={e => updateRow(row.id, { value: e.target.value })}
                    rows={2}
                    className="text-sm"
                  />
                  {/* Placeholder tokens hint */}
                  {row.value.includes("[") && (
                    <div className="flex flex-wrap gap-1">
                      {(row.value.match(/\[([^\]]+)\]/g) || []).map((token, i) => (
                        <Badge key={i} variant="outline" className="text-[10px]">{token}</Badge>
                      ))}
                    </div>
                  )}
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => handleSave(row)}>
                    Save
                  </Button>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
