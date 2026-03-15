/**
 * @module sessionPhases
 * @description Phase templates for coworking sessions (structured and focus-only formats).
 * Structured 4hr: icebreaker(15m) → deep_work(90m) → social_break(30m) → deep_work(90m) → wrap_up(15m).
 * Structured 2hr: icebreaker(10m) → deep_work(40m) → mini_break(10m) → deep_work(40m) → wrap_up(20m).
 * Focus Only 2hr: check_in(5m) → deep_work(50m) → silent_break(5m) → deep_work(50m) → wrap_up(10m).
 * Focus Only 4hr: check_in(5m) → deep_work(110m) → silent_break(10m) → deep_work(110m) → wrap_up(5m).
 *
 * Key exports:
 * - STRUCTURED_4HR_PHASES / STRUCTURED_2HR_PHASES — Structured phase template arrays
 * - FOCUS_ONLY_2HR_PHASES / FOCUS_ONLY_4HR_PHASES — Focus-only phase template arrays (no icebreaker/social)
 * - createSessionPhases() — Insert phase rows into session_phases table for an event
 * - getFormatLabel() — Human-readable format label ("Structured 4hr", "Focus Only 2hr", etc.)
 * - getFormatPhases() — Get phase templates for a given format string
 * - isFocusOnlyFormat() — Check if a format is focus-only (no social elements)
 *
 * Dependencies: Supabase client (inserts into session_phases table)
 * Related: Session.tsx (displays phase progression), Admin (creates sessions with phases), IcebreakerEngine.tsx (runs icebreaker phase)
 */
import { supabase } from "@/integrations/supabase/client";

export interface PhaseTemplate {
  phase_order: number;
  phase_type: string;
  phase_label: string;
  duration_minutes: number;
}

// WHY these phase timings: Based on research + user testing during beta.
// Icebreaker 15min: Enough to learn names and what everyone's working on. Shorter
// feels rushed with 5 people; longer eats into the deep work people came for.
// Deep work 90min: Matches the "ultradian rhythm" — humans focus in ~90min cycles
// (Peretz Lavie, Nathaniel Kleitman). Two 90min blocks = the session's core value.
// Social break 30min: Long enough for genuine conversation (not just bathroom break).
// This is where serendipitous connections happen — the "water cooler" moment.
// Wrap-up 15min: Go-around for what each person accomplished + peer props.
export const STRUCTURED_4HR_PHASES: PhaseTemplate[] = [
  { phase_order: 1, phase_type: "icebreaker", phase_label: "Icebreaker", duration_minutes: 15 },
  { phase_order: 2, phase_type: "deep_work", phase_label: "Deep Work Block 1", duration_minutes: 90 },
  { phase_order: 3, phase_type: "social_break", phase_label: "Social Break", duration_minutes: 30 },
  { phase_order: 4, phase_type: "deep_work", phase_label: "Deep Work Block 2", duration_minutes: 90 },
  { phase_order: 5, phase_type: "wrap_up", phase_label: "Wrap-Up & Props", duration_minutes: 15 },
];

// WHY 2hr format exists: Not everyone has 4 hours. The 2hr "lunch session" format
// targets office workers with a 12-2pm window. Compressed timings (10/40/10/40/20)
// preserve the icebreaker→work→break→work→wrapup rhythm at half the duration.
// WHY wrap-up is 20min (not 10): 2hr sessions merge social+wrap-up because
// there's no 30min social break — the wrap-up IS the social moment.
export const STRUCTURED_2HR_PHASES: PhaseTemplate[] = [
  { phase_order: 1, phase_type: "icebreaker", phase_label: "Icebreaker", duration_minutes: 10 },
  { phase_order: 2, phase_type: "deep_work", phase_label: "Deep Work Block 1", duration_minutes: 40 },
  { phase_order: 3, phase_type: "mini_break", phase_label: "Mini Break", duration_minutes: 10 },
  { phase_order: 4, phase_type: "deep_work", phase_label: "Deep Work Block 2", duration_minutes: 40 },
  { phase_order: 5, phase_type: "wrap_up", phase_label: "Social + Wrap-Up", duration_minutes: 20 },
];

// WHY focus-only formats exist: Some users explicitly want zero social overhead —
// they came to work, not chat. "check_in" replaces "icebreaker" (just names, 5min),
// "silent_break" replaces "social_break" (stretch/bathroom only), and deep work blocks
// are maximized. This format tests whether pure productivity attracts a different audience.
export const FOCUS_ONLY_2HR_PHASES: PhaseTemplate[] = [
  { phase_order: 1, phase_type: "check_in", phase_label: "Check-in", duration_minutes: 5 },
  { phase_order: 2, phase_type: "deep_work", phase_label: "Deep Work Block 1", duration_minutes: 50 },
  { phase_order: 3, phase_type: "silent_break", phase_label: "Silent Break", duration_minutes: 5 },
  { phase_order: 4, phase_type: "deep_work", phase_label: "Deep Work Block 2", duration_minutes: 50 },
  { phase_order: 5, phase_type: "wrap_up", phase_label: "Quick Wrap", duration_minutes: 10 },
];

export const FOCUS_ONLY_4HR_PHASES: PhaseTemplate[] = [
  { phase_order: 1, phase_type: "check_in", phase_label: "Check-in", duration_minutes: 5 },
  { phase_order: 2, phase_type: "deep_work", phase_label: "Deep Work Block 1", duration_minutes: 110 },
  { phase_order: 3, phase_type: "silent_break", phase_label: "Silent Break", duration_minutes: 10 },
  { phase_order: 4, phase_type: "deep_work", phase_label: "Deep Work Block 2", duration_minutes: 110 },
  { phase_order: 5, phase_type: "wrap_up", phase_label: "Quick Wrap", duration_minutes: 5 },
];

export async function createSessionPhases(eventId: string, format: string) {
  if (format === "casual") return;
  const phases = getFormatPhases(format);
  if (phases.length === 0) return;
  const rows = phases.map(p => ({ ...p, event_id: eventId }));
  await supabase.from("session_phases").insert(rows);
}

export function getFormatLabel(format: string | null) {
  if (format === "structured_4hr") return "Structured 4hr";
  if (format === "structured_2hr") return "Structured 2hr";
  if (format === "focus_only_2hr") return "Focus Only 2hr";
  if (format === "focus_only_4hr") return "Focus Only 4hr";
  return "Casual";
}

export function getFormatPhases(format: string): PhaseTemplate[] {
  if (format === "structured_4hr") return STRUCTURED_4HR_PHASES;
  if (format === "structured_2hr") return STRUCTURED_2HR_PHASES;
  if (format === "focus_only_2hr") return FOCUS_ONLY_2HR_PHASES;
  if (format === "focus_only_4hr") return FOCUS_ONLY_4HR_PHASES;
  return [];
}

export function isFocusOnlyFormat(format: string | null): boolean {
  return format?.startsWith("focus_only") ?? false;
}

/**
 * Returns true when the format string refers to a custom template (UUID) rather
 * than one of the built-in format keys.
 */
export function isCustomTemplateFormat(format: string | null): boolean {
  if (!format) return false;
  return format.startsWith("template:");
}

/**
 * Extract the template UUID from a format string like "template:<uuid>".
 */
export function extractTemplateId(format: string): string | null {
  if (!format.startsWith("template:")) return null;
  return format.slice("template:".length);
}
