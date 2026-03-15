/**
 * Tests for Quick Questions system — continuous taste data collection.
 * Verifies component structure, migration schema, and FC integration.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const SRC = path.resolve(__dirname, "../..");
const MIGRATION_DIR = path.resolve(SRC, "../supabase/migrations");

describe("QuickQuestionsCard component", () => {
  const content = fs.readFileSync(
    path.join(SRC, "components/home/QuickQuestionsCard.tsx"),
    "utf-8"
  );

  it("exists as a component file", () => {
    expect(
      fs.existsSync(path.join(SRC, "components/home/QuickQuestionsCard.tsx"))
    ).toBe(true);
  });

  it("handles all 5 question types", () => {
    expect(content).toContain("this_or_that");
    expect(content).toContain("emoji_pick");
    expect(content).toContain("chip_select");
    expect(content).toContain("slider");
    expect(content).toContain("quick_text");
  });

  it("awards FC via awardCredits (not direct insert)", () => {
    expect(content).toContain('import { awardCredits }');
    expect(content).toContain("awardCredits(");
    expect(content).toContain('"taste_answer"');
  });

  it("limits questions per session via sessionStorage", () => {
    expect(content).toContain("sessionStorage");
    expect(content).toContain("MAX_PER_SESSION");
  });

  it("has skip/dismiss functionality", () => {
    expect(content).toContain("handleSkip");
    expect(content).toContain("handleDismiss");
    expect(content).toContain("Skip");
  });

  it("shows match accuracy progress", () => {
    expect(content).toContain("accuracy");
    expect(content).toContain("match accuracy");
    expect(content).toContain("<Progress");
  });

  it("saves answers to taste_answers table", () => {
    expect(content).toContain('"taste_answers"');
    expect(content).toContain("upsert");
  });

  it("fetches unanswered questions ordered by priority", () => {
    expect(content).toContain('"taste_questions"');
    expect(content).toContain("priority");
    expect(content).toContain("ascending: false");
  });
});

describe("QuickQuestionsCard integration", () => {
  it("is imported in the Home page", () => {
    const home = fs.readFileSync(
      path.join(SRC, "pages/Home/index.tsx"),
      "utf-8"
    );
    expect(home).toContain("QuickQuestionsCard");
    expect(home).toContain(
      'import { QuickQuestionsCard } from "@/components/home/QuickQuestionsCard"'
    );
  });

  it("renders before ProfilePromptCard on Home page", () => {
    const home = fs.readFileSync(
      path.join(SRC, "pages/Home/index.tsx"),
      "utf-8"
    );
    const qqPos = home.indexOf("<QuickQuestionsCard");
    const ppPos = home.indexOf("<ProfilePromptCard");
    expect(qqPos).toBeGreaterThan(-1);
    expect(ppPos).toBeGreaterThan(-1);
    expect(qqPos).toBeLessThan(ppPos);
  });
});

describe("Taste engine migration", () => {
  const migrationFile = fs
    .readdirSync(MIGRATION_DIR)
    .find((f) => f.includes("taste_engine"));

  it("migration file exists", () => {
    expect(migrationFile).toBeDefined();
  });

  const migration = fs.readFileSync(
    path.join(MIGRATION_DIR, migrationFile!),
    "utf-8"
  );

  it("creates taste_questions table", () => {
    expect(migration).toContain("CREATE TABLE taste_questions");
  });

  it("creates taste_answers table", () => {
    expect(migration).toContain("CREATE TABLE taste_answers");
  });

  it("enables RLS on both tables", () => {
    expect(migration).toContain(
      "ALTER TABLE taste_questions ENABLE ROW LEVEL SECURITY"
    );
    expect(migration).toContain(
      "ALTER TABLE taste_answers ENABLE ROW LEVEL SECURITY"
    );
  });

  it("has unique constraint on (user_id, question_id) to prevent duplicates", () => {
    expect(migration).toContain("UNIQUE(user_id, question_id)");
  });

  it("question_type is constrained to 5 valid types", () => {
    expect(migration).toContain("this_or_that");
    expect(migration).toContain("emoji_pick");
    expect(migration).toContain("chip_select");
    expect(migration).toContain("slider");
    expect(migration).toContain("quick_text");
  });

  it("category is constrained to 4 valid categories", () => {
    expect(migration).toContain("work_dna");
    expect(migration).toContain("personality");
    expect(migration).toContain("lifestyle");
    expect(migration).toContain("contextual");
  });

  it("seeds at least 50 questions", () => {
    // Count INSERT VALUES — each question is a separate tuple starting with ('
    const questionCount = (migration.match(/^\('/gm) || []).length;
    expect(questionCount).toBeGreaterThanOrEqual(50);
  });

  it("includes work_dna questions with taste_graph_field mappings", () => {
    expect(migration).toContain("taste_graph_field");
    expect(migration).toContain("'role_type'");
    expect(migration).toContain("'skills'");
    expect(migration).toContain("'work_looking_for'");
    expect(migration).toContain("'work_can_offer'");
  });

  it("uses gen_random_uuid() for primary keys", () => {
    expect(migration).toContain("gen_random_uuid()");
  });

  it("references auth.users for user_id foreign key", () => {
    expect(migration).toContain("REFERENCES auth.users(id)");
  });
});

describe("FC integration for taste_answer", () => {
  it("taste_answer is a valid CreditAction", () => {
    const fc = fs.readFileSync(
      path.join(SRC, "lib/focusCredits.ts"),
      "utf-8"
    );
    expect(fc).toContain("'taste_answer'");
  });

  it("taste_answer is NOT in CONTRIBUTION_ACTIONS (separate cap)", () => {
    const fc = fs.readFileSync(
      path.join(SRC, "lib/focusCredits.ts"),
      "utf-8"
    );
    // CONTRIBUTION_ACTIONS set should not include taste_answer
    const setStart = fc.indexOf("CONTRIBUTION_ACTIONS");
    const setEnd = fc.indexOf("])", setStart);
    const setContent = fc.slice(setStart, setEnd);
    expect(setContent).not.toContain("taste_answer");
  });
});
