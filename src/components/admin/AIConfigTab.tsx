import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Bot, Zap, FileText, BarChart3, Sparkles } from "lucide-react";

// ─── Provider Management ──────────────────────────
function ProvidersSection() {
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("ai_providers").select("*").order("created_at").then(({ data }) => {
      setProviders(data || []);
      setLoading(false);
    });
  }, []);

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("ai_providers").update({ is_active: !current }).eq("id", id);
    setProviders(p => p.map(x => x.id === id ? { ...x, is_active: !current } : x));
    toast.success(`${id} ${!current ? "enabled" : "disabled"}`);
  };

  if (loading) return <Skeleton className="h-32" />;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground flex items-center gap-1.5"><Bot className="w-4 h-4" /> Providers</p>
      {providers.map(p => (
        <Card key={p.id}>
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{p.display_name}</p>
              <p className="text-[10px] text-muted-foreground">{p.base_url}</p>
              <p className="text-[10px] text-muted-foreground">Key: {p.api_key_env}</p>
            </div>
            <Switch checked={p.is_active} onCheckedChange={() => toggleActive(p.id, p.is_active)} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Task Configuration ──────────────────────────
function TaskConfigSection() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [edits, setEdits] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("ai_task_config").select("*").order("task_type"),
      supabase.from("ai_providers").select("id, display_name").eq("is_active", true),
    ]).then(([t, p]) => {
      setTasks(t.data || []);
      setProviders(p.data || []);
      setLoading(false);
    });
  }, []);

  const getEdit = (taskType: string) => edits[taskType] || {};
  const setEdit = (taskType: string, field: string, value: any) => {
    setEdits(prev => ({ ...prev, [taskType]: { ...prev[taskType], [field]: value } }));
  };

  const save = async (task: any) => {
    const edit = getEdit(task.task_type);
    const updates: any = {};
    if (edit.provider_id !== undefined) updates.provider_id = edit.provider_id;
    if (edit.model !== undefined) updates.model = edit.model;
    if (edit.temperature !== undefined) updates.temperature = parseFloat(edit.temperature);
    if (edit.max_tokens !== undefined) updates.max_tokens = parseInt(edit.max_tokens);
    if (edit.system_prompt !== undefined) updates.system_prompt = edit.system_prompt;
    if (edit.is_active !== undefined) updates.is_active = edit.is_active;
    if (edit.fallback_to_template !== undefined) updates.fallback_to_template = edit.fallback_to_template;
    updates.updated_at = new Date().toISOString();

    await supabase.from("ai_task_config").update(updates).eq("task_type", task.task_type);
    setTasks(prev => prev.map(t => t.task_type === task.task_type ? { ...t, ...updates } : t));
    setEdits(prev => { const n = { ...prev }; delete n[task.task_type]; return n; });
    toast.success(`Updated ${task.task_type}`);
  };

  if (loading) return <Skeleton className="h-48" />;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground flex items-center gap-1.5"><Zap className="w-4 h-4" /> Task Configuration</p>
      {tasks.map(task => {
        const edit = getEdit(task.task_type);
        return (
          <Card key={task.task_type}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs">{task.task_type}</Badge>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">Active</span>
                  <Switch
                    checked={edit.is_active ?? task.is_active}
                    onCheckedChange={v => setEdit(task.task_type, "is_active", v)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={edit.provider_id ?? task.provider_id}
                  onValueChange={v => setEdit(task.task_type, "provider_id", v)}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Provider" /></SelectTrigger>
                  <SelectContent>
                    {providers.map(p => <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  className="h-8 text-xs"
                  value={edit.model ?? task.model}
                  onChange={e => setEdit(task.task_type, "model", e.target.value)}
                  placeholder="Model"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">Temperature</label>
                  <Input
                    className="h-8 text-xs"
                    type="number" step="0.1" min="0" max="2"
                    value={edit.temperature ?? task.temperature}
                    onChange={e => setEdit(task.task_type, "temperature", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Max Tokens</label>
                  <Input
                    className="h-8 text-xs"
                    type="number"
                    value={edit.max_tokens ?? task.max_tokens}
                    onChange={e => setEdit(task.task_type, "max_tokens", e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">System Prompt</label>
                <Textarea
                  className="text-xs min-h-[60px]"
                  value={edit.system_prompt ?? task.system_prompt ?? ""}
                  onChange={e => setEdit(task.task_type, "system_prompt", e.target.value)}
                  rows={2}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">Fallback to template</span>
                  <Switch
                    checked={edit.fallback_to_template ?? task.fallback_to_template}
                    onCheckedChange={v => setEdit(task.task_type, "fallback_to_template", v)}
                  />
                </div>
                <Button size="sm" className="h-7 text-xs" onClick={() => save(task)}
                  disabled={Object.keys(edit).length === 0}>Save</Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Template Management ──────────────────────────
function TemplatesSection() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [edits, setEdits] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("match_templates").select("*").order("priority", { ascending: false }).then(({ data }) => {
      setTemplates(data || []);
      setLoading(false);
    });
  }, []);

  const setEdit = (id: string, field: string, value: any) => {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const save = async (t: any) => {
    const edit = edits[t.id] || {};
    const updates: any = {};
    if (edit.template !== undefined) updates.template = edit.template;
    if (edit.icebreaker_template !== undefined) updates.icebreaker_template = edit.icebreaker_template;
    if (edit.priority !== undefined) updates.priority = parseInt(edit.priority);
    if (edit.is_active !== undefined) updates.is_active = edit.is_active;

    await supabase.from("match_templates").update(updates).eq("id", t.id);
    setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, ...updates } : x));
    setEdits(prev => { const n = { ...prev }; delete n[t.id]; return n; });
    toast.success(`Updated ${t.match_type}`);
  };

  if (loading) return <Skeleton className="h-48" />;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground flex items-center gap-1.5"><FileText className="w-4 h-4" /> Templates</p>
        <p className="text-[9px] text-muted-foreground">
          Placeholders: {"{{user_name}}, {{match_name}}, {{vibe}}, {{user_need}}, {{match_skill}}, {{industry}}, {{goal}}, {{user_skill}}"}
        </p>
      </div>
      {templates.map(t => {
        const edit = edits[t.id] || {};
        return (
          <Card key={t.id}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs">{t.match_type}</Badge>
                <div className="flex items-center gap-2">
                  <Input
                    className="h-7 w-14 text-xs text-center"
                    type="number"
                    value={edit.priority ?? t.priority}
                    onChange={e => setEdit(t.id, "priority", e.target.value)}
                    title="Priority"
                  />
                  <Switch
                    checked={edit.is_active ?? t.is_active}
                    onCheckedChange={v => setEdit(t.id, "is_active", v)}
                  />
                </div>
              </div>
              <Textarea
                className="text-xs min-h-[40px]"
                value={edit.template ?? t.template}
                onChange={e => setEdit(t.id, "template", e.target.value)}
                rows={2}
              />
              <Input
                className="h-8 text-xs"
                value={edit.icebreaker_template ?? t.icebreaker_template ?? ""}
                onChange={e => setEdit(t.id, "icebreaker_template", e.target.value)}
                placeholder="Icebreaker template (optional)"
              />
              <div className="flex justify-end">
                <Button size="sm" className="h-7 text-xs" onClick={() => save(t)}
                  disabled={!edits[t.id] || Object.keys(edits[t.id]).length === 0}>Save</Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Usage Stats ──────────────────────────────────
function UsageSection() {
  const [stats, setStats] = useState<{ total: number; template: number; ai: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("ai_usage_log").select("source").then(({ data }) => {
      const rows = data || [];
      const template = rows.filter(r => r.source === "template").length;
      const ai = rows.filter(r => r.source === "ai").length;
      setStats({ total: rows.length, template, ai });
      setLoading(false);
    });
  }, []);

  if (loading) return <Skeleton className="h-24" />;
  if (!stats || stats.total === 0) return (
    <Card><CardContent className="p-4 text-center text-sm text-muted-foreground">No AI usage data yet</CardContent></Card>
  );

  const templatePct = Math.round((stats.template / stats.total) * 100);
  const estimatedSavings = (stats.template * 0.001).toFixed(3);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground flex items-center gap-1.5"><BarChart3 className="w-4 h-4" /> Usage Stats</p>
      <div className="grid grid-cols-3 gap-2">
        <Card><CardContent className="p-3 text-center">
          <p className="text-xl font-bold text-foreground">{stats.total}</p>
          <p className="text-[10px] text-muted-foreground">Total Generated</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-xl font-bold text-foreground">{templatePct}%</p>
          <p className="text-[10px] text-muted-foreground">Template</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-xl font-bold text-foreground">${estimatedSavings}</p>
          <p className="text-[10px] text-muted-foreground">Est. Saved</p>
        </CardContent></Card>
      </div>
      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${templatePct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Template: {stats.template}</span>
        <span>AI: {stats.ai}</span>
      </div>
    </div>
  );
}

// ─── Generate Match Insights Button ──────────────
function GenerateInsightsSection() {
  const [sessionId, setSessionId] = useState("");
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    if (!sessionId.trim()) { toast.error("Enter a session ID"); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-match-explanations", {
        body: { session_id: sessionId.trim() },
      });
      if (error) throw error;
      toast.success(`Generated ${data?.generated || 0} match insights`);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate insights");
    }
    setGenerating(false);
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
          <Sparkles className="w-4 h-4" /> Generate Match Insights
        </p>
        <p className="text-[10px] text-muted-foreground">
          Run after groups are formed for a session. Uses templates first, falls back to AI.
        </p>
        <div className="flex gap-2">
          <Input
            value={sessionId}
            onChange={e => setSessionId(e.target.value)}
            placeholder="Session/Event ID"
            className="flex-1"
          />
          <Button size="sm" onClick={generate} disabled={generating}>
            {generating ? "Generating..." : "Generate"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Tab ────────────────────────────────────
export function AIConfigTab() {
  return (
    <div className="space-y-6">
      <GenerateInsightsSection />
      <UsageSection />
      <ProvidersSection />
      <TaskConfigSection />
      <TemplatesSection />
    </div>
  );
}
