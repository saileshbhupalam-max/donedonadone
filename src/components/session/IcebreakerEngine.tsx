import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { IcebreakerRound } from "@/lib/icebreakers";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  rounds: IcebreakerRound[];
  onComplete: () => void;
  onIntentionSet?: (intention: string) => void;
}

export function IcebreakerEngine({ rounds, onComplete, onIntentionSet }: Props) {
  const [roundIdx, setRoundIdx] = useState(0);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [intention, setIntention] = useState("");
  const [halfwayAlert, setHalfwayAlert] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const round = rounds[roundIdx];
  const question = round?.questions[questionIdx];
  const totalRounds = rounds.length;

  // Start timer for current round
  useEffect(() => {
    if (!round) return;
    setTimeLeft(round.timerSeconds);
    setHalfwayAlert(false);
    setQuestionIdx(0);

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [roundIdx, rounds]);

  // Halfway alert for pair_share
  useEffect(() => {
    if (round?.type === "pair_share" && timeLeft === Math.floor(round.timerSeconds / 2) && timeLeft > 0) {
      setHalfwayAlert(true);
      setTimeout(() => setHalfwayAlert(false), 3000);
    }
  }, [timeLeft, round]);

  // Auto-advance quick fire questions
  useEffect(() => {
    if (round?.type === "quick_fire" && round.questions.length > 1) {
      const perQuestion = Math.floor(round.timerSeconds / round.questions.length);
      const elapsed = round.timerSeconds - timeLeft;
      const newIdx = Math.min(Math.floor(elapsed / perQuestion), round.questions.length - 1);
      if (newIdx !== questionIdx) setQuestionIdx(newIdx);
    }
  }, [timeLeft, round, questionIdx]);

  const nextRound = useCallback(() => {
    clearInterval(timerRef.current);
    if (roundIdx < totalRounds - 1) {
      setRoundIdx(prev => prev + 1);
    } else {
      onComplete();
    }
  }, [roundIdx, totalRounds, onComplete]);

  const nextQuestion = () => {
    if (round && questionIdx < round.questions.length - 1) {
      setQuestionIdx(prev => prev + 1);
    } else {
      nextRound();
    }
  };

  const handleIntentionSubmit = () => {
    if (intention.trim() && onIntentionSet) {
      onIntentionSet(intention.trim());
    }
    nextRound();
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (!round) return null;

  return (
    <div className="space-y-4">
      {/* Round indicator */}
      <div className="flex items-center justify-center gap-2">
        {rounds.map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-2.5 h-2.5 rounded-full transition-all",
              i < roundIdx ? "bg-primary" :
              i === roundIdx ? "bg-primary animate-pulse scale-125" :
              "bg-border"
            )}
          />
        ))}
      </div>
      <p className="text-xs text-center text-muted-foreground">
        Round {roundIdx + 1} of {totalRounds} · {round.label}
      </p>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${roundIdx}-${questionIdx}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-primary/20">
            <CardContent className="p-6 text-center space-y-4">
              {/* Instruction */}
              <p className="text-xs text-muted-foreground">{round.instruction}</p>

              {/* Question */}
              <div className="space-y-2">
                <span className="text-4xl">{question?.emoji || "💬"}</span>
                <p className="font-serif text-lg text-foreground leading-relaxed">
                  {question?.question}
                </p>
              </div>

              {/* Timer */}
              <div className={cn(
                "text-2xl font-mono font-bold",
                timeLeft <= 10 ? "text-destructive" : "text-primary"
              )}>
                {formatTime(timeLeft)}
              </div>

              {/* Halfway alert for pair share */}
              {halfwayAlert && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-primary/10 rounded-lg p-3"
                >
                  <p className="text-sm font-medium text-primary">🔄 Switch! Other person's turn.</p>
                </motion.div>
              )}

              {/* Time's up */}
              {timeLeft === 0 && round.type !== "intention_set" && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-muted rounded-lg p-3"
                >
                  <p className="text-sm font-medium text-foreground">
                    {round.type === "group_challenge" ? "Time's up! How'd you do? 😄" : "Time's up! ⏰"}
                  </p>
                </motion.div>
              )}

              {/* Intention set input */}
              {round.type === "intention_set" && (
                <div className="space-y-3">
                  <Input
                    value={intention}
                    onChange={e => setIntention(e.target.value.slice(0, 140))}
                    placeholder="My intention for this session..."
                    maxLength={140}
                    className="text-center"
                  />
                  <Button onClick={handleIntentionSubmit} disabled={!intention.trim()} className="w-full">
                    Set Intention ✨
                  </Button>
                </div>
              )}

              {/* Navigation */}
              {round.type !== "intention_set" && (
                <div className="flex gap-2 justify-center">
                  {round.type === "quick_fire" && round.questions.length > 1 && questionIdx < round.questions.length - 1 && (
                    <Button variant="outline" size="sm" onClick={nextQuestion}>
                      Next Question →
                    </Button>
                  )}
                  <Button size="sm" onClick={nextRound}>
                    {roundIdx < totalRounds - 1 ? "Next Round →" : "Let's Go! 🚀"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
