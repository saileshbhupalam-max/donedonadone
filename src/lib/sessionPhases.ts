/**
 * @module sessionPhases
 * @description Phase templates for structured coworking sessions (2hr and 4hr formats).
 * 4hr: icebreaker(15min) → deep_work(90min) → social_break(30min) → deep_work(90min) → wrap_up(15min).
 * 2hr: icebreaker(10min) → deep_work(40min) → mini_break(10min) → deep_work(40min) → wrap_up(20min).
 *
 * Key exports:
 * - STRUCTURED_4HR_PHASES / STRUCTURED_2HR_PHASES — Phase template arrays
 * - createSessionPhases() — Insert phase rows into session_phases table for an event
 * - getFormatLabel() — Human-readable format label ("Structured 4hr", "Casual", etc.)
 * - getFormatPhases() — Get phase templates for a given format string
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

export const STRUCTURED_4HR_PHASES: PhaseTemplate[] = [
  { phase_order: 1, phase_type: "icebreaker", phase_label: "Icebreaker", duration_minutes: 15 },
  { phase_order: 2, phase_type: "deep_work", phase_label: "Deep Work Block 1", duration_minutes: 90 },
  { phase_order: 3, phase_type: "social_break", phase_label: "Social Break", duration_minutes: 30 },
  { phase_order: 4, phase_type: "deep_work", phase_label: "Deep Work Block 2", duration_minutes: 90 },
  { phase_order: 5, phase_type: "wrap_up", phase_label: "Wrap-Up & Props", duration_minutes: 15 },
];

export const STRUCTURED_2HR_PHASES: PhaseTemplate[] = [
  { phase_order: 1, phase_type: "icebreaker", phase_label: "Icebreaker", duration_minutes: 10 },
  { phase_order: 2, phase_type: "deep_work", phase_label: "Deep Work Block 1", duration_minutes: 40 },
  { phase_order: 3, phase_type: "mini_break", phase_label: "Mini Break", duration_minutes: 10 },
  { phase_order: 4, phase_type: "deep_work", phase_label: "Deep Work Block 2", duration_minutes: 40 },
  { phase_order: 5, phase_type: "wrap_up", phase_label: "Social + Wrap-Up", duration_minutes: 20 },
];

export async function createSessionPhases(eventId: string, format: string) {
  if (format === "casual") return;
  const phases = format === "structured_4hr" ? STRUCTURED_4HR_PHASES : STRUCTURED_2HR_PHASES;
  const rows = phases.map(p => ({ ...p, event_id: eventId }));
  await supabase.from("session_phases").insert(rows);
}

export function getFormatLabel(format: string | null) {
  if (format === "structured_4hr") return "Structured 4hr";
  if (format === "structured_2hr") return "Structured 2hr";
  return "Casual";
}

export function getFormatPhases(format: string): PhaseTemplate[] {
  if (format === "structured_4hr") return STRUCTURED_4HR_PHASES;
  if (format === "structured_2hr") return STRUCTURED_2HR_PHASES;
  return [];
}
