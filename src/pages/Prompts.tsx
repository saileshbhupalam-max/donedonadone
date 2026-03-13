import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { usePrompts, usePromptAnswers, AnswerSort, Prompt } from "@/hooks/usePrompts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, ChevronDown, Flame } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { usePageTitle } from "@/hooks/usePageTitle";
import { WhatsAppShareButton } from "@/components/sharing/WhatsAppButton";
import { getPromptShareMessage } from "@/lib/sharing";


const categoryColors: Record<string, string> = {
  interests: "bg-primary/15 text-primary",
  work_style: "bg-secondary/15 text-secondary",
  social: "bg-accent text-accent-foreground",
  reflection: "bg-muted text-muted-foreground",
  icebreaker: "bg-primary/10 text-primary",
};

function CharCounter({ count, max }: { count: number; max: number }) {
  return (
    <span className={cn(
      "text-xs tabular-nums",
      count >= max * 0.96 ? "text-destructive" : count >= max * 0.8 ? "text-yellow-600" : "text-muted-foreground"
    )}>
      {count}/{max}
    </span>
  );
}

/* ── Active Prompt Answers Section ── */
function ActivePromptAnswers({ promptId, promptQuestion }: { promptId: string; promptQuestion?: string }) {
  const {
    responses, myResponse, profiles, loading, sort, setSort,
    visibleCount, loadMore, submitAnswer, toggleReaction, myReactions, totalCount,
  } = usePromptAnswers(promptId);

  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);

  const handleSubmit = async () => {
    const text = draft.trim();
    if (!text) return;
    await submitAnswer(text);
    setDraft("");
    setEditing(false);
  };

  const sortTabs: { value: AnswerSort; label: string }[] = [
    { value: "recent", label: "Recent" },
    { value: "fire", label: "Most 🔥" },
    { value: "match", label: "People Like You" },
  ];

  return (
    <div className="space-y-4">
      {/* My answer area */}
      {myResponse && !editing ? (
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-primary mb-1">Your answer</p>
                <p className="text-sm text-foreground whitespace-pre-line">{myResponse.answer}</p>
              </div>
              <button onClick={() => { setDraft(myResponse.answer ?? ""); setEditing(true); }}
                className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors">
                <Pencil className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            {promptQuestion && myResponse.answer && (
              <WhatsAppShareButton
                message={getPromptShareMessage(promptQuestion, myResponse.answer)}
                label="Share your answer"
                size="sm"
                variant="ghost"
                className="text-xs h-7 px-2"
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={e => setDraft(e.target.value.slice(0, 500))}
            placeholder="Share your thoughts..."
            rows={3}
            className="resize-none"
          />
          <div className="flex items-center justify-between">
            <CharCounter count={draft.length} max={500} />
            <div className="flex gap-2">
              {editing && (
                <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setDraft(""); }}>Never mind</Button>
              )}
              <Button size="sm" onClick={handleSubmit} disabled={!draft.trim()}>
                {myResponse ? "Update" : "Done"}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Your answer helps the community get to know you</p>
        </div>
      )}

      {/* Sort tabs */}
      <div className="flex gap-1 border-b border-border">
        {sortTabs.map(t => (
          <button key={t.value} onClick={() => setSort(t.value)}
            className={cn(
              "px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px",
              sort === t.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Answer cards */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : responses.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">This page is quiet. Too quiet. Answer a prompt — your words are how we find your people.</p>
      ) : (
        <>
          {responses.slice(0, visibleCount).map(r => {
            const p = profiles[r.user_id];
            const initials = getInitials(p?.display_name);
            const reacted = myReactions.has(r.id);
            return (
              <Card key={r.id} className="overflow-hidden">
                <CardContent className="pt-4">
                  <div className="flex gap-3">
                    <Link to={`/profile/${r.user_id}`}>
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={p?.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-muted text-muted-foreground text-xs">{initials}</AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link to={`/profile/${r.user_id}`} className="font-semibold text-sm text-foreground hover:underline truncate">
                          {p?.display_name ?? "Member"}
                        </Link>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {r.created_at ? formatDistanceToNow(parseISO(r.created_at), { addSuffix: true }) : ""}
                        </span>
                      </div>
                      <p className="text-sm text-foreground mt-1 whitespace-pre-line">{r.answer}</p>
                      <button
                        onClick={() => toggleReaction(r.id)}
                        className={cn(
                          "mt-2 flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-all",
                          reacted
                            ? "bg-primary/15 text-primary border-primary/30"
                            : "bg-card text-muted-foreground border-border hover:border-primary/40"
                        )}
                      >
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={reacted ? "on" : "off"}
                            initial={{ scale: 0.5 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.5 }}
                            transition={{ duration: 0.15 }}
                          >
                            <Flame className={cn("w-3.5 h-3.5", reacted && "fill-primary")} />
                          </motion.span>
                        </AnimatePresence>
                        {(r.fire_count ?? 0) > 0 && <span>{r.fire_count}</span>}
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {visibleCount < totalCount && (
            <div className="text-center">
              <Button variant="outline" size="sm" onClick={loadMore}>Load more</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Previous Prompt Card (collapsible) ── */
function PreviousPromptCard({ prompt, userId }: { prompt: Prompt; userId: string | undefined }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <button className="w-full text-left px-4 py-3 flex items-center gap-3">
            <span className="text-xl">{prompt.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{prompt.question}</p>
              <p className="text-xs text-muted-foreground">{prompt.response_count ?? 0} answers</p>
            </div>
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 border-t border-border pt-3">
            {open && <ActivePromptAnswers promptId={prompt.id} promptQuestion={prompt.question} />}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

/* ── Main Page ── */
export default function Prompts() {
  usePageTitle("The Question — FocusClub");
  const { activePrompt, previousPrompts, loading, user } = usePrompts();

  if (loading) {
    return (
      <AppShell>
        <div className="px-4 pt-4 space-y-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-4 pt-4 pb-8 space-y-6">
        <h1 className="font-serif text-2xl text-foreground">The Question</h1>

        {/* Featured active prompt */}
        {activePrompt && (
          <Card className="overflow-hidden">
            <CardContent className="pt-5 space-y-1">
              <div className="flex items-center gap-2 mb-2">
                {activePrompt.category && (
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", categoryColors[activePrompt.category] ?? categoryColors.icebreaker)}>
                    {activePrompt.category.replace("_", " ")}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{activePrompt.response_count ?? 0} answers</span>
              </div>
              <p className="font-serif text-xl text-foreground leading-snug">
                {activePrompt.emoji} {activePrompt.question}
              </p>
              <p className="text-xs text-muted-foreground">This week's prompt</p>
            </CardContent>
          </Card>
        )}

        {/* Answers for active prompt */}
        {activePrompt && <ActivePromptAnswers promptId={activePrompt.id} promptQuestion={activePrompt.question} />}

        {/* Previous prompts */}
        {previousPrompts.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-serif text-lg text-foreground">Previous Prompts</h2>
            {previousPrompts.map(p => (
              <PreviousPromptCard key={p.id} prompt={p} userId={user?.id} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
