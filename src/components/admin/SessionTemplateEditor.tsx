/**
 * @module SessionTemplateEditor
 * @description Admin UI for creating and editing custom session templates.
 * Provides a phase builder with reordering, a visual timeline preview,
 * and template validation before saving.
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown, Clock, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  type SessionTemplate,
  type SessionTemplateInput,
  type TemplatePhase,
  type PhaseType,
  PHASE_TYPES,
  PHASE_TYPE_META,
  createEmptyPhase,
  validateTemplate,
  saveTemplate,
} from "@/lib/sessionTemplates";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SessionTemplateEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When editing an existing template, pass it here. */
  template?: SessionTemplate | null;
  /** Called after a successful save. */
  onSaved?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SessionTemplateEditor({
  open,
  onOpenChange,
  template,
  onSaved,
}: SessionTemplateEditorProps) {
  const { user } = useAuth();

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [venuePartnerId, setVenuePartnerId] = useState<string>("global");
  const [phases, setPhases] = useState<TemplatePhase[]>([createEmptyPhase(1)]);
  const [venuePartners, setVenuePartners] = useState<{ id: string; venue_name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || "");
      setVenuePartnerId(template.venuePartnerId || "global");
      setPhases(template.phases.length > 0 ? template.phases : [createEmptyPhase(1)]);
    } else {
      setName("");
      setDescription("");
      setVenuePartnerId("global");
      setPhases([createEmptyPhase(1)]);
    }
  }, [template, open]);

  // Fetch venue partners
  useEffect(() => {
    supabase
      .from("venue_partners")
      .select("id, venue_name")
      .eq("status", "active")
      .order("venue_name")
      .then(({ data }) => setVenuePartners(data || []));
  }, []);

  // Computed total
  const totalMinutes = useMemo(
    () => phases.reduce((sum, p) => sum + (p.durationMinutes || 0), 0),
    [phases],
  );

  // ---------------------------------------------------------------------------
  // Phase manipulation
  // ---------------------------------------------------------------------------

  const addPhase = useCallback(() => {
    setPhases((prev) => [...prev, createEmptyPhase(prev.length + 1)]);
  }, []);

  const removePhase = useCallback((index: number) => {
    setPhases((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((p, i) => ({ ...p, order: i + 1 }));
    });
  }, []);

  const movePhase = useCallback((index: number, direction: "up" | "down") => {
    setPhases((prev) => {
      const next = [...prev];
      const swapIdx = direction === "up" ? index - 1 : index + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[index], next[swapIdx]] = [next[swapIdx], next[index]];
      return next.map((p, i) => ({ ...p, order: i + 1 }));
    });
  }, []);

  const updatePhase = useCallback(
    (index: number, patch: Partial<TemplatePhase>) => {
      setPhases((prev) =>
        prev.map((p, i) => {
          if (i !== index) return p;
          const updated = { ...p, ...patch };
          // Auto-set label from type when type changes (unless custom)
          if (patch.type && patch.type !== "custom" && p.type !== patch.type) {
            updated.label = PHASE_TYPE_META[patch.type].label;
          }
          return updated;
        }),
      );
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const handleSave = async () => {
    const input: Partial<SessionTemplateInput> = {
      name,
      description: description || null,
      venuePartnerId: venuePartnerId === "global" ? null : venuePartnerId,
      totalDurationMinutes: totalMinutes,
      phases,
      isActive: true,
      createdBy: user?.id ?? null,
    };

    const errors = validateTemplate(input);
    if (errors.length > 0) {
      errors.forEach((e) => toast.error(e));
      return;
    }

    setSaving(true);
    const result = await saveTemplate(input as SessionTemplateInput, template?.id);
    setSaving(false);

    if (result) {
      toast.success(template ? "Template updated!" : "Template created!");
      onOpenChange(false);
      onSaved?.();
    } else {
      toast.error("Failed to save template. Check console for details.");
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {template ? "Edit Session Template" : "Create Session Template"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Name */}
          <div>
            <Label>Template Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Morning Focus Sprint"
            />
          </div>

          {/* Description */}
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this template..."
              rows={2}
            />
          </div>

          {/* Venue Partner */}
          <div>
            <Label>Linked Venue</Label>
            <Select value={venuePartnerId} onValueChange={setVenuePartnerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select venue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global (all venues)</SelectItem>
                {venuePartners.map((vp) => (
                  <SelectItem key={vp.id} value={vp.id}>
                    {vp.venue_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Phase Builder */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Phases</Label>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  {totalMinutes} min ({Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m)
                </span>
              </div>
            </div>

            {phases.map((phase, idx) => (
              <Card key={idx} className="border-l-4" style={{ borderLeftColor: phaseColor(phase.type) }}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    {/* Order + arrows */}
                    <div className="flex flex-col items-center gap-0.5 pt-1">
                      <span className="text-xs font-mono text-muted-foreground w-5 text-center">
                        {idx + 1}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        disabled={idx === 0}
                        onClick={() => movePhase(idx, "up")}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        disabled={idx === phases.length - 1}
                        onClick={() => movePhase(idx, "down")}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Fields */}
                    <div className="flex-1 grid grid-cols-[1fr_1fr_80px] gap-2">
                      {/* Type */}
                      <Select
                        value={phase.type}
                        onValueChange={(v) => updatePhase(idx, { type: v as PhaseType })}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PHASE_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {PHASE_TYPE_META[t].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Label */}
                      <Input
                        className="h-9 text-xs"
                        value={phase.label}
                        onChange={(e) => updatePhase(idx, { label: e.target.value })}
                        placeholder="Phase label"
                      />

                      {/* Duration */}
                      <div className="relative">
                        <Input
                          className="h-9 text-xs pr-8"
                          type="number"
                          min={1}
                          value={phase.durationMinutes}
                          onChange={(e) =>
                            updatePhase(idx, { durationMinutes: parseInt(e.target.value) || 0 })
                          }
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                          min
                        </span>
                      </div>
                    </div>

                    {/* Delete */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      disabled={phases.length <= 1}
                      onClick={() => removePhase(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button variant="outline" size="sm" className="w-full" onClick={addPhase}>
              <Plus className="h-4 w-4 mr-1" /> Add Phase
            </Button>
          </div>

          {/* Visual Timeline Preview */}
          {totalMinutes > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Timeline Preview</Label>
              <div className="flex rounded-lg overflow-hidden h-8 border">
                {phases.map((phase, idx) => {
                  const pct = (phase.durationMinutes / totalMinutes) * 100;
                  if (pct <= 0) return null;
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-center text-white text-[10px] font-medium truncate px-1"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: phaseColor(phase.type),
                        minWidth: pct > 5 ? undefined : "4px",
                      }}
                      title={`${phase.label} (${phase.durationMinutes}min)`}
                    >
                      {pct > 12 ? `${phase.label} (${phase.durationMinutes}m)` : ""}
                    </div>
                  );
                })}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {phases.map((phase, idx) => (
                  <div key={idx} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: phaseColor(phase.type) }}
                    />
                    {phase.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Save */}
          <Button className="w-full" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : template ? "Update Template" : "Create Template"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return a hex color for timeline rendering. */
function phaseColor(type: PhaseType): string {
  const map: Record<PhaseType, string> = {
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
