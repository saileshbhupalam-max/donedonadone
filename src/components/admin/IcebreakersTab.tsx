import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface IcebreakerQ {
  id: string;
  question: string;
  category: string;
  depth: string;
  emoji: string;
  active: boolean;
  times_used: number;
}

const CATEGORIES = ["quick_fire", "pair_share", "group_challenge", "intention_set"];
const DEPTHS = ["light", "medium", "deep"];
const CAT_LABELS: Record<string, string> = {
  quick_fire: "Quick Fire", pair_share: "Pair & Share",
  group_challenge: "Group Challenge", intention_set: "Intention Set",
};

export function IcebreakersTab() {
  const [questions, setQuestions] = useState<IcebreakerQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmoji, setNewEmoji] = useState("💬");
  const [newQuestion, setNewQuestion] = useState("");
  const [newCategory, setNewCategory] = useState("quick_fire");
  const [newDepth, setNewDepth] = useState("light");
  const [sortBy, setSortBy] = useState<"category" | "times_used">("category");

  const fetch = async () => {
    const { data } = await supabase.from("icebreaker_questions").select("*").order("category").order("times_used", { ascending: true });
    setQuestions(data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("icebreaker_questions").update({ active: !active }).eq("id", id);
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, active: !active } : q));
  };

  const addQuestion = async () => {
    if (!newQuestion.trim()) return;
    await supabase.from("icebreaker_questions").insert({
      question: newQuestion.trim(),
      category: newCategory,
      depth: newDepth,
      emoji: newEmoji || "💬",
    });
    setNewQuestion("");
    setNewEmoji("💬");
    toast.success("Question added!");
    fetch();
  };

  const sorted = useMemo(() => {
    if (sortBy === "times_used") return [...questions].sort((a, b) => b.times_used - a.times_used);
    return questions;
  }, [questions, sortBy]);

  if (loading) return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;

  return (
    <div className="space-y-4">
      {/* Add new */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Add Icebreaker Question</p>
          <div className="flex gap-2">
            <Input value={newEmoji} onChange={e => setNewEmoji(e.target.value)} placeholder="💬" className="w-14" />
            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{CAT_LABELS[c]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={newDepth} onValueChange={setNewDepth}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEPTHS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Input value={newQuestion} onChange={e => setNewQuestion(e.target.value)} placeholder="Your icebreaker question..." />
          <Button size="sm" onClick={addQuestion} disabled={!newQuestion.trim()}>Add Question</Button>
        </CardContent>
      </Card>

      {/* Sort */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Sort:</span>
        <Button size="sm" variant={sortBy === "category" ? "default" : "outline"} onClick={() => setSortBy("category")} className="text-xs h-7">Category</Button>
        <Button size="sm" variant={sortBy === "times_used" ? "default" : "outline"} onClick={() => setSortBy("times_used")} className="text-xs h-7">Most Used</Button>
        <span className="text-xs text-muted-foreground ml-auto">{questions.length} questions</span>
      </div>

      {/* List */}
      <div className="space-y-2">
        {sorted.map(q => (
          <Card key={q.id} className={!q.active ? "opacity-50" : ""}>
            <CardContent className="p-3 flex items-center gap-3">
              <span className="text-lg shrink-0">{q.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{q.question}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px]">{CAT_LABELS[q.category] || q.category}</Badge>
                  <Badge variant="outline" className="text-[10px]">{q.depth}</Badge>
                  <span className="text-[10px] text-muted-foreground">Used {q.times_used}×</span>
                </div>
              </div>
              <Switch checked={q.active} onCheckedChange={() => toggleActive(q.id, q.active)} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
