import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Flag } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { parseISO } from "date-fns";
import { CaptainBadge } from "@/components/captain/CaptainCard";
import { FlagMemberForm } from "@/components/session/FlagMemberForm";
import { STATUS_CONFIG } from "./constants";
import { MemberStatusRow } from "./types";

interface TrafficLightPanelProps {
  myStatus: string;
  topic: string;
  groupStatuses: MemberStatusRow[];
  userId: string;
  eventId: string;
  onStatusUpdate: (status: string, ut?: string, tp?: string) => void;
  onTopicChange: (topic: string) => void;
}

export function TrafficLightPanel({ myStatus, topic, groupStatuses, userId, eventId, onStatusUpdate, onTopicChange }: TrafficLightPanelProps) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h3 className="font-serif text-sm text-foreground">Your Status</h3>
        <div className="flex gap-2">
          {(["red", "amber", "green"] as const).map(s => (
            <Button
              key={s}
              size="sm"
              variant={myStatus === s ? "default" : "outline"}
              className={cn("flex-1", myStatus === s && s === "red" && "bg-destructive text-destructive-foreground",
                myStatus === s && s === "green" && "bg-secondary text-secondary-foreground")}
              onClick={() => onStatusUpdate(s, undefined, topic || undefined)}
            >
              {STATUS_CONFIG[s].emoji} {STATUS_CONFIG[s].label}
            </Button>
          ))}
        </div>
        {myStatus === "amber" && (
          <Input
            value={topic}
            onChange={e => onTopicChange(e.target.value)}
            placeholder="Topics you're open to discuss"
            onBlur={() => onStatusUpdate("amber", undefined, topic)}
            className="text-xs"
          />
        )}

        <h3 className="font-serif text-sm text-foreground mt-3">Your Table</h3>
        <div className="space-y-2">
          {groupStatuses.filter(s => s.user_id !== userId).map(s => {
            const cfg = STATUS_CONFIG[s.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.green;
            return (
              <div key={s.user_id} className="flex items-center gap-3">
                <div className={cn("rounded-full ring-2 p-0.5", cfg.ringClass)}>
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={s.profile?.avatar_url || ""} />
                    <AvatarFallback className="text-[10px]">{getInitials(s.profile?.display_name)}</AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-foreground">{s.profile?.display_name || "Member"}</p>
                    {s.profile?.is_table_captain && <CaptainBadge />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {s.status === "red" && `Deep focus${s.until_time ? ` until ${parseISO(s.until_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}`}
                    {s.status === "amber" && `\u{1F4AC} ${s.topic || "Open to chat"}`}
                    {s.status === "green" && "\u2615 Light work, come chat"}
                  </p>
                </div>
                <span className="text-lg">{cfg.emoji}</span>
                <Dialog>
                  <DialogTrigger asChild>
                    <button className="p-1.5 rounded-lg bg-muted/50 md:bg-transparent hover:bg-muted transition-colors text-muted-foreground hover:text-destructive" title="Report">
                      <Flag className="w-3.5 h-3.5" />
                    </button>
                  </DialogTrigger>
                  <DialogContent>
                    <FlagMemberForm
                      eventId={eventId}
                      attendees={groupStatuses.filter(gs => gs.user_id !== userId).map(gs => ({
                        id: gs.user_id,
                        display_name: gs.profile?.display_name || null,
                        avatar_url: gs.profile?.avatar_url || null,
                      }))}
                      onDone={() => {}}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            );
          })}
          {groupStatuses.filter(s => s.user_id !== userId).length === 0 && (
            <p className="text-xs text-muted-foreground text-center">No one else has joined yet</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
