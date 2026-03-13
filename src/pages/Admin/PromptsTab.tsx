import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export function PromptsTab() {
  const [prompts, setPrompts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmoji, setNewEmoji] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const [newCategory, setNewCategory] = useState("");

  const fetchPrompts = async () => {
    const { data } = await supabase.from("prompts").select("*").order("sort_order", { ascending: true });
    setPrompts(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchPrompts(); }, []);

  const setActive = async (id: string) => {
    try {
      // Deactivate all, activate selected
      await supabase.from("prompts").update({ is_active: false }).neq("id", "none");
      await supabase.from("prompts").update({ is_active: true }).eq("id", id);

      // Notify all members
      const { data: profiles } = await supabase.from("profiles").select("id").eq("onboarding_completed", true);
      const prompt = prompts.find((p) => p.id === id);
      if (profiles && prompt) {
        for (const p of profiles) {
          await supabase.rpc("create_system_notification", {
            p_user_id: p.id,
            p_title: `New prompt: ${prompt.emoji || "💬"} ${prompt.question.slice(0, 50)}`,
            p_body: "Share your answer with the community!",
            p_type: "new_prompt",
            p_link: "/prompts",
          });
        }
      }

      toast.success("Prompt activated & members notified!");
      fetchPrompts();
    } catch (error) {
      console.error("[SetActivePrompt]", error);
      toast.error("Something went wrong activating the prompt.");
    }
  };

  const createPrompt = async () => {
    if (!newQuestion) return;
    try {
      const maxOrder = Math.max(0, ...prompts.map((p) => p.sort_order || 0));
      const { error } = await supabase.from("prompts").insert({
        question: newQuestion,
        emoji: newEmoji || null,
        category: newCategory || null,
        sort_order: maxOrder + 1,
      });
      if (error) throw error;
      setNewQuestion(""); setNewEmoji(""); setNewCategory("");
      toast.success("Prompt created!");
      fetchPrompts();
    } catch (error) {
      console.error("[CreatePrompt]", error);
      toast.error("Something went wrong creating the prompt.");
    }
  };

  if (loading) return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Create New Prompt</p>
          <div className="flex gap-2">
            <Input value={newEmoji} onChange={(e) => setNewEmoji(e.target.value)} placeholder="🎯" className="w-14" />
            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                {["work_style", "interests", "social", "reflection", "icebreaker"].map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} placeholder="Your prompt question..." rows={2} />
          <Button size="sm" onClick={createPrompt} disabled={!newQuestion}>Create Prompt</Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {prompts.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-3 flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span>{p.emoji || "💬"}</span>
                  <p className="text-sm text-foreground truncate">{p.question}</p>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {p.category && <Badge variant="outline" className="text-[10px]">{p.category}</Badge>}
                  <span className="text-[10px] text-muted-foreground">{p.response_count || 0} responses</span>
                </div>
              </div>
              {p.is_active ? (
                <Badge className="bg-secondary text-secondary-foreground shrink-0">Active</Badge>
              ) : (
                <Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={() => setActive(p.id)}>Set Active</Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
