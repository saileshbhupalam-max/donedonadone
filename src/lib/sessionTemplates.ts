/**
 * @module sessionTemplates
 * @description Configurable session templates that allow venue partners and admins
 * to define custom session formats with arbitrary phases, durations, and labels.
 *
 * Key exports:
 * - SessionTemplate / TemplatePhase — Type definitions
 * - fetchTemplatesForVenue() — Get templates linked to a specific venue partner
 * - fetchGlobalTemplates() — Get templates not linked to any venue
 * - fetchAllTemplates() — Get all templates (admin use)
 * - saveTemplate() — Create or update a template
 * - deleteTemplate() — Soft-delete (deactivate) a template
 * - createPhasesFromTemplate() — Generate session_phases rows from a template
 * - validateTemplate() — Validate template data, returns error strings
 *
 * Dependencies: Supabase client
 * Related: sessionPhases.ts (hardcoded formats), CreateEventButton.tsx, Admin/TemplatesTab.tsx
 */
import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const PHASE_TYPES = [
  "icebreaker",
  "deep_work",
  "social_break",
  "mini_break",
  "check_in",
  "silent_break",
  "wrap_up",
  "custom",
] as const;

export type PhaseType = (typeof PHASE_TYPES)[number];

export interface TemplatePhase {
  order: number;
  type: PhaseType;
  label: string;
  durationMinutes: number;
  description?: string;
}

export interface SessionTemplate {
  id: string;
  name: string;
  description: string | null;
  venuePartnerId: string | null;
  totalDurationMinutes: number;
  phases: TemplatePhase[];
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined field (optional)
  venueName?: string;
}

/** Shape used when creating / updating (no id or timestamps). */
export type SessionTemplateInput = Omit<SessionTemplate, "id" | "createdAt" | "updatedAt" | "venueName">;

// ---------------------------------------------------------------------------
// Phase type metadata (labels + colors for UI)
// ---------------------------------------------------------------------------

export const PHASE_TYPE_META: Record<PhaseType, { label: string; color: string }> = {
  icebreaker: { label: "Icebreaker", color: "bg-amber-500" },
  deep_work: { label: "Deep Work", color: "bg-blue-500" },
  social_break: { label: "Social Break", color: "bg-green-500" },
  mini_break: { label: "Mini Break", color: "bg-emerald-400" },
  check_in: { label: "Check-in", color: "bg-teal-500" },
  silent_break: { label: "Silent Break", color: "bg-slate-400" },
  wrap_up: { label: "Wrap-Up", color: "bg-purple-500" },
  custom: { label: "Custom", color: "bg-gray-500" },
};

// ---------------------------------------------------------------------------
// DB row ↔ app type helpers
// ---------------------------------------------------------------------------

interface DbRow {
  id: string;
  name: string;
  description: string | null;
  venue_partner_id: string | null;
  total_duration_minutes: number;
  phases: unknown;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  venue_partners?: { venue_name: string } | null;
}

function rowToTemplate(row: DbRow): SessionTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    venuePartnerId: row.venue_partner_id,
    totalDurationMinutes: row.total_duration_minutes,
    phases: (row.phases as TemplatePhase[]) ?? [],
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    venueName: row.venue_partners?.venue_name ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

export async function fetchTemplatesForVenue(venuePartnerId: string): Promise<SessionTemplate[]> {
  const { data, error } = await supabase
    .from("session_templates" as any)
    .select("*, venue_partners(venue_name)")
    .eq("venue_partner_id", venuePartnerId)
    .eq("is_active", true)
    .order("name");

  if (error) {
    console.error("fetchTemplatesForVenue error:", error);
    return [];
  }
  return (data as unknown as DbRow[]).map(rowToTemplate);
}

export async function fetchGlobalTemplates(): Promise<SessionTemplate[]> {
  const { data, error } = await supabase
    .from("session_templates" as any)
    .select("*, venue_partners(venue_name)")
    .is("venue_partner_id", null)
    .eq("is_active", true)
    .order("name");

  if (error) {
    console.error("fetchGlobalTemplates error:", error);
    return [];
  }
  return (data as unknown as DbRow[]).map(rowToTemplate);
}

export async function fetchAllTemplates(): Promise<SessionTemplate[]> {
  const { data, error } = await supabase
    .from("session_templates" as any)
    .select("*, venue_partners(venue_name)")
    .order("name");

  if (error) {
    console.error("fetchAllTemplates error:", error);
    return [];
  }
  return (data as unknown as DbRow[]).map(rowToTemplate);
}

// ---------------------------------------------------------------------------
// Save / update / delete
// ---------------------------------------------------------------------------

export async function saveTemplate(
  input: SessionTemplateInput,
  existingId?: string,
): Promise<SessionTemplate | null> {
  const payload = {
    name: input.name,
    description: input.description,
    venue_partner_id: input.venuePartnerId,
    total_duration_minutes: input.totalDurationMinutes,
    phases: input.phases as any,
    is_active: input.isActive,
    created_by: input.createdBy,
  };

  if (existingId) {
    const { data, error } = await supabase
      .from("session_templates" as any)
      .update(payload)
      .eq("id", existingId)
      .select("*, venue_partners(venue_name)")
      .single();

    if (error) {
      console.error("saveTemplate (update) error:", error);
      return null;
    }
    return rowToTemplate(data as unknown as DbRow);
  }

  const { data, error } = await supabase
    .from("session_templates" as any)
    .insert(payload)
    .select("*, venue_partners(venue_name)")
    .single();

  if (error) {
    console.error("saveTemplate (insert) error:", error);
    return null;
  }
  return rowToTemplate(data as unknown as DbRow);
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("session_templates" as any)
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    console.error("deleteTemplate error:", error);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Create session phases from a template
// ---------------------------------------------------------------------------

export async function createPhasesFromTemplate(
  eventId: string,
  templateId: string,
): Promise<boolean> {
  // Fetch the template
  const { data, error: fetchErr } = await supabase
    .from("session_templates" as any)
    .select("*")
    .eq("id", templateId)
    .single();

  if (fetchErr || !data) {
    console.error("createPhasesFromTemplate: template not found", fetchErr);
    return false;
  }

  const template = rowToTemplate(data as unknown as DbRow);

  if (template.phases.length === 0) return true;

  const rows = template.phases.map((p) => ({
    event_id: eventId,
    phase_order: p.order,
    phase_type: p.type,
    phase_label: p.label,
    duration_minutes: p.durationMinutes,
  }));

  const { error } = await supabase.from("session_phases").insert(rows);

  if (error) {
    console.error("createPhasesFromTemplate: insert error", error);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateTemplate(input: Partial<SessionTemplateInput>): string[] {
  const errors: string[] = [];

  if (!input.name?.trim()) {
    errors.push("Template name is required.");
  }

  if (!input.phases || input.phases.length === 0) {
    errors.push("At least one phase is required.");
  } else {
    for (let i = 0; i < input.phases.length; i++) {
      const p = input.phases[i];
      if (!p.label?.trim()) {
        errors.push(`Phase ${i + 1}: label is required.`);
      }
      if (!p.durationMinutes || p.durationMinutes <= 0) {
        errors.push(`Phase ${i + 1}: duration must be greater than 0.`);
      }
    }

    const total = input.phases.reduce((sum, p) => sum + (p.durationMinutes || 0), 0);
    if (total <= 0) {
      errors.push("Total duration must be greater than 0.");
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Utility: default empty phase for the editor
// ---------------------------------------------------------------------------

export function createEmptyPhase(order: number): TemplatePhase {
  return {
    order,
    type: "deep_work",
    label: "Deep Work",
    durationMinutes: 30,
  };
}
