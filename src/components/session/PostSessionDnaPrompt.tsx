import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Dna } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  calculateDnaCompletion,
  getNextIncompleteCategory,
  TasteGraphRow,
  DnaCategory,
} from "@/lib/dnaCompletion";

// ─── Option data (subset of TasteGraphBuilder) ────────────────
const ROLE_OPTIONS = [
  { value: "founder", label: "Founder" },
  { value: "freelancer", label: "Freelancer" },
  { value: "employee", label: "Employee" },
  { value: "student", label: "Student" },
  { value: "creative", label: "Creative" },
  { value: "figuring_it_out", label: "Figuring It Out" },
];

const SKILL_OPTIONS = ["React", "Python", "AI/ML", "UI/UX", "Marketing", "Writing", "Sales", "Product Management"];
const LOOKING_FOR_OPTIONS = ["A designer", "A developer", "A co-founder", "A mentor", "Clients/projects", "Someone to brainstorm with"];
const CAN_OFFER_OPTIONS = ["Code reviews", "Design feedback", "Mentoring", "Marketing help", "Domain expertise", "Product feedback"];
const TOPIC_OPTIONS = ["AI/ML", "Design", "Startups", "Sustainability", "Investing", "Content Creation", "Productivity", "Fitness"];

interface Props {
  userId: string;
  onComplete?: () => void;
  onSkip?: () => void;
}

export function PostSessionDnaPrompt({ userId, onComplete, onSkip }: Props) {
  const [tasteGraph, setTasteGraph] = useState<TasteGraphRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selection, setSelection] = useState<string | string[]>("");

  // Which category to prompt
  const promptCat = tasteGraph !== undefined ? getNextIncompleteCategory(tasteGraph) : null;

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("taste_graph")
        .select("role_type, skills, work_looking_for, work_can_offer, topics, industries, values, peak_hours")
        .eq("user_id", userId)
        .maybeSingle();
      setTasteGraph(data as TasteGraphRow | null);
      setLoading(false);
    })();
  }, [userId]);

  if (loading || !promptCat || saved) {
    if (saved) {
      return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 text-center space-y-1">
              <Check className="w-5 h-5 text-primary mx-auto" />
              <p className="text-sm font-medium text-foreground">Saved!</p>
              <p className="text-xs text-muted-foreground">
                Your Work DNA is now {calculateDnaCompletion(tasteGraph)}% complete
              </p>
            </CardContent>
          </Card>
        </motion.div>
      );
    }
    return null;
  }

  const isMulti = promptCat.key !== "role_type";

  const getOptions = (): { value: string; label: string }[] => {
    switch (promptCat.key) {
      case "role_type":
        return ROLE_OPTIONS;
      case "skills":
        return SKILL_OPTIONS.map(s => ({ value: s, label: s }));
      case "work_looking_for":
        return LOOKING_FOR_OPTIONS.map(s => ({ value: s, label: s }));
      case "work_can_offer":
        return CAN_OFFER_OPTIONS.map(s => ({ value: s, label: s }));
      case "topics":
        return TOPIC_OPTIONS.map(s => ({ value: s, label: s }));
      default:
        return [];
    }
  };

  const toggleMulti = (val: string) => {
    const arr = Array.isArray(selection) ? selection : [];
    setSelection(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
  };

  const handleSave = async () => {
    if (!selection || (Array.isArray(selection) && selection.length === 0)) return;
    setSaving(true);

    const updateFields: Record<string, unknown> = {};
    if (promptCat.key === "role_type") {
      updateFields.role_type = selection as string;
    } else {
      updateFields[promptCat.key] = selection as string[];
    }

    // Compute new completion
    const newTg = { ...tasteGraph, ...updateFields } as TasteGraphRow;
    const newPct = calculateDnaCompletion(newTg);
    updateFields.work_profile_complete = newPct;

    const { error } = await supabase
      .from("taste_graph")
      .upsert({ user_id: userId, ...updateFields }, { onConflict: "user_id" });

    setSaving(false);
    if (error) {
      toast.error("Failed to save");
      return;
    }
    setTasteGraph(newTg);
    setSaved(true);
    onComplete?.();
  };

  const options = getOptions();

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-primary/20">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Dna className="w-4 h-4 text-primary" />
            <p className="text-xs text-muted-foreground">Quick question before you go...</p>
          </div>

          <p className="font-serif text-sm text-foreground">{promptCat.question}</p>

          <div className="flex gap-1.5 flex-wrap">
            {options.map(opt => {
              const isSelected = isMulti
                ? (Array.isArray(selection) && selection.includes(opt.value))
                : selection === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => isMulti ? toggleMulti(opt.value) : setSelection(opt.value)}
                  className={`px-3 py-1.5 text-xs rounded-full font-medium border transition-all ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-foreground hover:bg-muted"
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || (!selection || (Array.isArray(selection) && selection.length === 0))}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-muted-foreground"
              onClick={() => onSkip?.()}
            >
              I'll do this later
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
