/**
 * @module TemplatesTab
 * @description Admin dashboard tab showing all session templates with
 * create / edit / deactivate actions.
 */
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Clock, Layout } from "lucide-react";
import {
  type SessionTemplate,
  PHASE_TYPE_META,
  fetchAllTemplates,
  deleteTemplate,
} from "@/lib/sessionTemplates";
import { SessionTemplateEditor } from "./SessionTemplateEditor";

export function TemplatesTab() {
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SessionTemplate | null>(null);

  const loadTemplates = async () => {
    setLoading(true);
    const data = await fetchAllTemplates();
    setTemplates(data);
    setLoading(false);
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  // Group templates: Global first, then by venue
  const grouped = useMemo(() => {
    const globalTemplates = templates.filter((t) => !t.venuePartnerId);
    const venueMap = new Map<string, { name: string; templates: SessionTemplate[] }>();

    for (const t of templates) {
      if (!t.venuePartnerId) continue;
      if (!venueMap.has(t.venuePartnerId)) {
        venueMap.set(t.venuePartnerId, { name: t.venueName || "Unknown Venue", templates: [] });
      }
      venueMap.get(t.venuePartnerId)!.templates.push(t);
    }

    return { globalTemplates, venueGroups: Array.from(venueMap.values()) };
  }, [templates]);

  const handleCreate = () => {
    setEditingTemplate(null);
    setEditorOpen(true);
  };

  const handleEdit = (t: SessionTemplate) => {
    setEditingTemplate(t);
    setEditorOpen(true);
  };

  const handleDelete = async (t: SessionTemplate) => {
    if (!confirm(`Deactivate template "${t.name}"? Sessions already using it won't be affected.`)) return;
    const ok = await deleteTemplate(t.id);
    if (ok) {
      toast.success("Template deactivated");
      loadTemplates();
    } else {
      toast.error("Failed to deactivate template");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl">Session Templates</h2>
          <p className="text-sm text-muted-foreground">
            Custom session formats that venue partners can use when creating events.
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" /> New Template
        </Button>
      </div>

      {templates.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Layout className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No session templates yet.</p>
            <p className="text-sm mt-1">Create one to get started.</p>
          </CardContent>
        </Card>
      )}

      {/* Global Templates */}
      {grouped.globalTemplates.length > 0 && (
        <TemplateGroup
          title="Global Templates"
          subtitle="Available at all venues"
          templates={grouped.globalTemplates}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {/* Venue-specific Templates */}
      {grouped.venueGroups.map((group) => (
        <TemplateGroup
          key={group.name}
          title={group.name}
          templates={group.templates}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      ))}

      {/* Editor dialog */}
      <SessionTemplateEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        template={editingTemplate}
        onSaved={loadTemplates}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TemplateGroup({
  title,
  subtitle,
  templates,
  onEdit,
  onDelete,
}: {
  title: string;
  subtitle?: string;
  templates: SessionTemplate[];
  onEdit: (t: SessionTemplate) => void;
  onDelete: (t: SessionTemplate) => void;
}) {
  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {templates.map((t) => (
        <TemplateCard key={t.id} template={t} onEdit={() => onEdit(t)} onDelete={() => onDelete(t)} />
      ))}
    </div>
  );
}

function TemplateCard({
  template,
  onEdit,
  onDelete,
}: {
  template: SessionTemplate;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const totalMinutes = template.totalDurationMinutes;

  return (
    <Card className={!template.isActive ? "opacity-50" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Info */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{template.name}</span>
              {!template.isActive && (
                <Badge variant="secondary" className="text-[10px]">
                  Inactive
                </Badge>
              )}
            </div>
            {template.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">{template.description}</p>
            )}

            {/* Phase chips + duration */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m
              </div>
              {template.phases.map((p, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-[10px] px-1.5 py-0"
                  style={{ borderColor: phaseHex(p.type as any) }}
                >
                  {p.label} ({p.durationMinutes}m)
                </Badge>
              ))}
            </div>

            {/* Timeline bar */}
            {totalMinutes > 0 && (
              <div className="flex rounded overflow-hidden h-2">
                {template.phases.map((p, i) => {
                  const pct = (p.durationMinutes / totalMinutes) * 100;
                  return (
                    <div
                      key={i}
                      style={{
                        width: `${pct}%`,
                        backgroundColor: phaseHex(p.type as any),
                        minWidth: "2px",
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-1 shrink-0">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function phaseHex(type: string): string {
  const map: Record<string, string> = {
    icebreaker: "#f59e0b",
    deep_work: "#3b82f6",
    social_break: "#22c55e",
    mini_break: "#34d399",
    check_in: "#14b8a6",
    silent_break: "#94a3b8",
    wrap_up: "#a855f7",
    custom: "#6b7280",
  };
  return map[type] ?? "#6b7280";
}
