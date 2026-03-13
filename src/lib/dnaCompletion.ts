/**
 * Shared DNA completion calculation — mirrors TasteGraphBuilder logic.
 * Used by PostSessionDnaPrompt, DnaCompletionNudge, and anywhere else
 * that needs to know how complete a user's Work DNA profile is.
 */

export interface TasteGraphRow {
  role_type?: string | null;
  skills?: string[] | null;
  work_looking_for?: string[] | null;
  work_can_offer?: string[] | null;
  topics?: string[] | null;
  industries?: string[] | null;
  values?: string[] | null;
  peak_hours?: string[] | null;
}

/** Returns 0-100 percentage */
export function calculateDnaCompletion(tg: TasteGraphRow | null | undefined): number {
  if (!tg) return 0;
  let pct = 0;
  if (tg.role_type) pct += 15;
  if ((tg.skills ?? []).length > 0) pct += 15;
  if ((tg.work_looking_for ?? []).length > 0) pct += 15;
  if ((tg.work_can_offer ?? []).length > 0) pct += 15;
  if ((tg.topics ?? []).length > 0) pct += 10;
  if ((tg.industries ?? []).length > 0) pct += 10;
  if ((tg.values ?? []).length > 0) pct += 10;
  if ((tg.peak_hours ?? []).length > 0) pct += 10;
  return pct;
}

export type DnaCategory = "role_type" | "skills" | "work_looking_for" | "work_can_offer" | "topics";

/** Priority-ordered categories for progressive profiling */
export const DNA_PROMPT_ORDER: { key: DnaCategory; question: string }[] = [
  { key: "role_type", question: "What best describes your work?" },
  { key: "skills", question: "What are your top skills?" },
  { key: "work_looking_for", question: "What are you looking for?" },
  { key: "work_can_offer", question: "What can you offer others?" },
  { key: "topics", question: "What topics interest you?" },
];

/** Find the first incomplete category */
export function getNextIncompleteCategory(tg: TasteGraphRow | null | undefined): typeof DNA_PROMPT_ORDER[number] | null {
  if (!tg) return DNA_PROMPT_ORDER[0];
  for (const cat of DNA_PROMPT_ORDER) {
    if (cat.key === "role_type") {
      if (!tg.role_type) return cat;
    } else {
      const arr = tg[cat.key];
      if (!arr || arr.length === 0) return cat;
    }
  }
  return null;
}
