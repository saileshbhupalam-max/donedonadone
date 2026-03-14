/* DESIGN: The scrapbook transforms sessions from "I attended" into "I remember."
   Auto-generated after each session, combining who was there, intentions, props,
   and photos into a shareable journal-like card. */

import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { getInitials } from "@/lib/utils";
import { Clock, Share2, Edit3, Check, MapPin, CalendarIcon } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { motion } from "framer-motion";

const PROP_EMOJIS: Record<string, string> = {
  energy: "⚡", helpful: "🤝", focused: "🎯", inspiring: "💡", fun: "🎉", kind: "💛",
};

interface GroupMember {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface PropReceived {
  from_user_id: string;
  from_display_name: string | null;
  prop_type: string;
}

export interface ScrapbookEntry {
  id: string;
  user_id: string;
  event_id: string;
  session_date: string;
  venue_name: string | null;
  venue_neighborhood: string | null;
  group_members: GroupMember[];
  cowork_again_picks: string[];
  intention: string | null;
  intention_accomplished: string | null;
  props_received: PropReceived[];
  photo_url: string | null;
  focus_hours: number | null;
  personal_note: string | null;
  highlight: string | null;
  created_at: string;
}

interface ScrapbookCardProps {
  entry: ScrapbookEntry;
  compact?: boolean;
  onNoteUpdated?: (note: string) => void;
}

export function ScrapbookCard({ entry, compact = false, onNoteUpdated }: ScrapbookCardProps) {
  const [editingNote, setEditingNote] = useState(false);
  const [note, setNote] = useState(entry.personal_note || "");
  const [saving, setSaving] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const saveNote = async () => {
    setSaving(true);
    const { error } = await supabase.from("session_scrapbook")
      .update({ personal_note: note })
      .eq("id", entry.id);
    setSaving(false);
    if (error) {
      toast.error("Couldn't save note");
    } else {
      setEditingNote(false);
      onNoteUpdated?.(note);
      toast.success("Note saved ✍️");
    }
  };

  const handleShare = async () => {
    if (!cardRef.current) return;
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, { useCORS: true, scale: 2 });
      canvas.toBlob(blob => {
        if (!blob) return;
        if (navigator.share) {
          const file = new File([blob], "danadone-session.png", { type: "image/png" });
          navigator.share({ files: [file], title: entry.highlight || "My DanaDone Session" }).catch(() => {});
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url; a.download = "danadone-session.png"; a.click();
          URL.revokeObjectURL(url);
          toast.success("Downloaded!");
        }
      });
    } catch {
      toast.error("Couldn't generate image");
    }
  };

  const intentionIcon = entry.intention_accomplished === "yes" ? "✅"
    : entry.intention_accomplished === "partially" ? "🔄" : "💪";

  const propCounts: Record<string, number> = {};
  (entry.props_received || []).forEach(p => {
    propCounts[p.prop_type] = (propCounts[p.prop_type] || 0) + 1;
  });

  if (compact) {
    return (
      <div className="flex items-center gap-3 py-2 border-b border-border last:border-0">
        <span className="text-lg">📔</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{entry.highlight || `Session at ${entry.venue_name || "unknown"}`}</p>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            {entry.venue_name && <span><MapPin className="w-2.5 h-2.5 inline" /> {entry.venue_name}</span>}
            {entry.group_members?.length > 0 && <span>· {entry.group_members.length} people</span>}
            {entry.intention && <span>· {intentionIcon}</span>}
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {(() => { try { return format(parseISO(entry.session_date), "MMM d"); } catch { return ""; } })()}
        </span>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-amber-200/40 dark:border-amber-900/30 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-stone-900/30 shadow-sm overflow-hidden">
        <div ref={cardRef}>
          <CardContent className="p-5 space-y-4">
            {/* Date + Venue header */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarIcon className="w-3 h-3" />
                {(() => { try { return format(parseISO(entry.session_date), "EEEE, MMMM d, yyyy"); } catch { return entry.session_date; } })()}
              </span>
              {entry.venue_name && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {entry.venue_name}
                </span>
              )}
            </div>

            {/* Highlight */}
            {entry.highlight && (
              <h3 className="font-serif text-base text-foreground leading-snug">{entry.highlight}</h3>
            )}

            {/* Group member avatars */}
            {entry.group_members?.length > 0 && (
              <div className="flex items-center gap-1">
                <div className="flex -space-x-2">
                  {entry.group_members.slice(0, 6).map(m => (
                    <Avatar key={m.user_id} className="w-8 h-8 border-2 border-background">
                      <AvatarImage src={m.avatar_url || ""} />
                      <AvatarFallback className="text-[9px] bg-muted">{getInitials(m.display_name)}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                {entry.group_members.length > 6 && (
                  <span className="text-xs text-muted-foreground ml-1">+{entry.group_members.length - 6}</span>
                )}
              </div>
            )}

            {/* Intention */}
            {entry.intention && (
              <div className="flex items-start gap-2 text-sm">
                <span>{intentionIcon}</span>
                <p className="text-foreground italic">"{entry.intention}"</p>
              </div>
            )}

            {/* Props received */}
            {Object.keys(propCounts).length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {Object.entries(propCounts).map(([type, count]) => (
                  <Badge key={type} variant="secondary" className="text-xs gap-1 rounded-full">
                    {PROP_EMOJIS[type] || "💫"} {count}
                  </Badge>
                ))}
              </div>
            )}

            {/* Photo */}
            {entry.photo_url && (
              <div className="rounded-xl overflow-hidden shadow-md">
                <img src={entry.photo_url} alt="Session photo" className="w-full h-40 object-cover" loading="lazy" />
              </div>
            )}

            {/* Focus hours */}
            {entry.focus_hours && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{entry.focus_hours}h deep work</span>
              </div>
            )}

            {/* Personal note */}
            {editingNote ? (
              <div className="space-y-2">
                <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add a reflection..." rows={3} className="text-sm" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveNote} disabled={saving} className="gap-1">
                    <Check className="w-3 h-3" /> {saving ? "Saving..." : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditingNote(false); setNote(entry.personal_note || ""); }}>Cancel</Button>
                </div>
              </div>
            ) : entry.personal_note ? (
              <div className="bg-background/60 rounded-lg p-3 text-sm text-foreground italic cursor-pointer" onClick={() => setEditingNote(true)}>
                "{entry.personal_note}"
              </div>
            ) : null}
          </CardContent>
        </div>

        {/* Actions */}
        <div className="px-5 pb-4 flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 flex-1" onClick={handleShare}>
            <Share2 className="w-3.5 h-3.5" /> Share
          </Button>
          {!editingNote && (
            <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setEditingNote(true)}>
              <Edit3 className="w-3.5 h-3.5" /> {entry.personal_note ? "Edit Note" : "Add Note"}
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
