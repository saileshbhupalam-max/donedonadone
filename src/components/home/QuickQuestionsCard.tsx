/**
 * Quick Questions — continuous taste data collection.
 *
 * Shows 2-3 lightweight questions on the Home page each time the user opens
 * the app. Different questions each time, infinite expandable pool.
 * Feels like a conversation, not a form.
 *
 * Key behaviors:
 * - Max 3 questions per app open (tracked in sessionStorage)
 * - "Skip for now" always visible
 * - Each answer awards FC via awardCredits()
 * - Progress bar shows match accuracy (answered / total)
 * - Questions never repeat (unique constraint in DB)
 * - Priority ordering: work_dna first, then personality, lifestyle, contextual
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { awardCredits } from "@/lib/focusCredits";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Sparkles, ChevronRight, X } from "lucide-react";

// ─── Types ──────────────────────────────────

interface TasteQuestion {
  id: string;
  question: string;
  question_type: "this_or_that" | "emoji_pick" | "chip_select" | "slider" | "quick_text";
  options: any;
  category: string;
  taste_graph_field: string | null;
  priority: number;
  fc_reward: number;
}

interface SliderOptions {
  min: number;
  max: number;
  minLabel: string;
  maxLabel: string;
}

interface EmojiOption {
  id: string;
  emoji: string;
  label: string;
}

interface ThisOrThatOption {
  label: string;
  emoji: string;
}

// ─── Constants ──────────────────────────────────

const SESSION_KEY = "qq_session_answered";
const MAX_PER_SESSION = 3;

function getSessionAnswered(): number {
  try { return parseInt(sessionStorage.getItem(SESSION_KEY) || "0", 10); }
  catch { return 0; }
}

function incrementSessionAnswered(): void {
  try { sessionStorage.setItem(SESSION_KEY, String(getSessionAnswered() + 1)); }
  catch { /* sessionStorage unavailable */ }
}

function isSessionDismissed(): boolean {
  try { return sessionStorage.getItem("qq_dismissed") === "true"; }
  catch { return false; }
}

function dismissForSession(): void {
  try { sessionStorage.setItem("qq_dismissed", "true"); }
  catch { /* sessionStorage unavailable */ }
}

// ─── Component ──────────────────────────────────

export function QuickQuestionsCard() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<TasteQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [dismissed, setDismissed] = useState(isSessionDismissed());
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Answer state for different question types
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [sliderValue, setSliderValue] = useState(3);
  const [textValue, setTextValue] = useState("");

  const fetchQuestions = useCallback(async () => {
    if (!user) return;

    // Get answered question IDs
    const { data: answered } = await supabase
      .from("taste_answers")
      .select("question_id")
      .eq("user_id", user.id);

    const answeredIds = new Set((answered || []).map((a: any) => a.question_id));

    // Get active questions ordered by priority
    const { data: allQ } = await supabase
      .from("taste_questions")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: false });

    const all = (allQ || []) as TasteQuestion[];
    const unanswered = all.filter(q => !answeredIds.has(q.id));

    // Only show up to (MAX_PER_SESSION - already answered this session) questions
    const sessionCount = getSessionAnswered();
    const remaining = Math.max(0, MAX_PER_SESSION - sessionCount);

    setQuestions(unanswered.slice(0, remaining));
    setTotalAnswered(answeredIds.size);
    setTotalQuestions(all.length);
    setLoaded(true);
  }, [user]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const currentQuestion = questions[currentIndex];

  const submitAnswer = async (answerValue: any) => {
    if (!user || !currentQuestion || saving) return;
    setSaving(true);

    // Save answer to DB
    await supabase.from("taste_answers").upsert({
      user_id: user.id,
      question_id: currentQuestion.id,
      answer: answerValue,
      credits_awarded: currentQuestion.fc_reward,
    } as any);

    // Award FC
    const result = await awardCredits(user.id, "taste_answer", currentQuestion.fc_reward, {
      question_id: currentQuestion.id,
    } as any);

    if (result.awarded > 0) {
      toast.success(`+${result.awarded} FC — your matches just got sharper`);
    }

    incrementSessionAnswered();
    setTotalAnswered(prev => prev + 1);

    // Reset answer state
    setSelectedChips([]);
    setSliderValue(3);
    setTextValue("");

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // All questions answered for this session
      setQuestions([]);
    }

    setSaving(false);
  };

  const handleSkip = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedChips([]);
      setSliderValue(3);
      setTextValue("");
    } else {
      dismissForSession();
      setDismissed(true);
    }
  };

  const handleDismiss = () => {
    dismissForSession();
    setDismissed(true);
  };

  // ─── Don't render conditions ──────────────────────────────────
  if (!user || dismissed || !loaded || questions.length === 0) return null;
  if (!currentQuestion) return null;

  const accuracy = totalQuestions > 0
    ? Math.round((totalAnswered / totalQuestions) * 100)
    : 0;

  return (
    <Card className="border-secondary/20 overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-secondary" />
            <span className="text-xs font-semibold text-foreground">Quick Questions</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">
              {currentQuestion.fc_reward} FC per answer
            </span>
            <button
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Question */}
        <div className="px-4 py-3">
          <p className="font-serif text-sm text-foreground mb-3">
            {currentQuestion.question}
          </p>

          {/* ─── This or That ─── */}
          {currentQuestion.question_type === "this_or_that" && (
            <div className="grid grid-cols-2 gap-2">
              {(currentQuestion.options as ThisOrThatOption[]).map((opt) => (
                <button
                  key={opt.label}
                  disabled={saving}
                  onClick={() => submitAnswer(opt.label)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all",
                    "border-border bg-card hover:border-primary/60 hover:bg-primary/5",
                    "active:scale-95"
                  )}
                >
                  <span className="text-2xl">{opt.emoji}</span>
                  <span className="text-xs font-medium text-foreground">{opt.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* ─── Emoji Pick ─── */}
          {currentQuestion.question_type === "emoji_pick" && (
            <div className={cn(
              "grid gap-2",
              (currentQuestion.options as EmojiOption[]).length <= 3 ? "grid-cols-3" : "grid-cols-4"
            )}>
              {(currentQuestion.options as EmojiOption[]).map((opt) => (
                <button
                  key={opt.id}
                  disabled={saving}
                  onClick={() => submitAnswer(opt.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all",
                    "border-border bg-card hover:border-primary/60 hover:bg-primary/5",
                    "active:scale-95"
                  )}
                >
                  <span className="text-xl">{opt.emoji}</span>
                  <span className="text-[10px] font-medium text-foreground leading-tight text-center">{opt.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* ─── Chip Select (multi, max 3) ─── */}
          {currentQuestion.question_type === "chip_select" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {(currentQuestion.options as string[]).map((chip) => (
                  <button
                    key={chip}
                    disabled={saving}
                    onClick={() => {
                      setSelectedChips(prev =>
                        prev.includes(chip)
                          ? prev.filter(c => c !== chip)
                          : prev.length < 3 ? [...prev, chip] : prev
                      );
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                      selectedChips.includes(chip)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:border-primary/40"
                    )}
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  Pick up to 3 ({selectedChips.length}/3)
                </span>
                <Button
                  size="sm"
                  disabled={saving || selectedChips.length === 0}
                  onClick={() => submitAnswer(selectedChips)}
                  className="h-7 text-xs px-3"
                >
                  {saving ? "..." : "Done"}
                  <ChevronRight className="w-3 h-3 ml-0.5" />
                </Button>
              </div>
            </div>
          )}

          {/* ─── Slider ─── */}
          {currentQuestion.question_type === "slider" && (() => {
            const opts = currentQuestion.options as SliderOptions;
            return (
              <div className="space-y-3">
                <div className="px-1">
                  <input
                    type="range"
                    min={opts.min}
                    max={opts.max}
                    value={sliderValue}
                    onChange={(e) => setSliderValue(parseInt(e.target.value, 10))}
                    className="w-full accent-primary h-2 rounded-lg appearance-none bg-muted cursor-pointer"
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground">{opts.minLabel}</span>
                    <span className="text-sm font-semibold text-foreground">{sliderValue}</span>
                    <span className="text-[10px] text-muted-foreground">{opts.maxLabel}</span>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={saving}
                    onClick={() => submitAnswer(sliderValue)}
                    className="h-7 text-xs px-3"
                  >
                    {saving ? "..." : "Done"}
                    <ChevronRight className="w-3 h-3 ml-0.5" />
                  </Button>
                </div>
              </div>
            );
          })()}

          {/* ─── Quick Text ─── */}
          {currentQuestion.question_type === "quick_text" && (() => {
            const opts = currentQuestion.options as { placeholder: string; maxLength: number } | null;
            return (
              <div className="space-y-3">
                <Input
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value.slice(0, opts?.maxLength || 80))}
                  placeholder={opts?.placeholder || "Type your answer..."}
                  className="rounded-xl text-sm"
                  maxLength={opts?.maxLength || 80}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && textValue.trim()) {
                      submitAnswer(textValue.trim());
                    }
                  }}
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {textValue.length}/{opts?.maxLength || 80}
                  </span>
                  <Button
                    size="sm"
                    disabled={saving || !textValue.trim()}
                    onClick={() => submitAnswer(textValue.trim())}
                    className="h-7 text-xs px-3"
                  >
                    {saving ? "..." : "Done"}
                    <ChevronRight className="w-3 h-3 ml-0.5" />
                  </Button>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Footer: progress + skip */}
        <div className="px-4 pb-3 space-y-2">
          {/* Progress indicator */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground shrink-0">
              {currentIndex + 1}/{questions.length}
            </span>
            <div className="flex gap-1 flex-1">
              {questions.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 rounded-full flex-1 transition-all",
                    i < currentIndex ? "bg-primary" :
                    i === currentIndex ? "bg-primary/50" : "bg-muted"
                  )}
                />
              ))}
            </div>
          </div>

          {/* Match accuracy + skip */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Progress value={accuracy} className="h-1.5 flex-1" />
              <span className="text-[10px] text-muted-foreground shrink-0">
                {accuracy}% match accuracy
              </span>
            </div>
            <button
              onClick={handleSkip}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors ml-3 shrink-0"
            >
              Skip
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
