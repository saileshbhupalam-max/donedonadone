/**
 * @module BlockButton
 * @description Block action with two modes:
 * 1. Safety block — counts toward escalation (3+ blocks → admin flag, 5+ → suspend)
 * 2. Personal preference — does NOT count toward escalation, just avoidance
 *
 * Both modes: blocker gets RSVP alerts, blocked person excluded from nudges.
 * Blocking is invisible to the blocked person in both cases.
 *
 * Dependencies: memberBlocks.ts
 * Tables: member_blocks (via lib)
 */
import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MoreHorizontal, ShieldBan, ShieldCheck, Flag, Heart, AlertTriangle } from "lucide-react";
import { blockUser, unblockUser, isBlocked } from "@/lib/memberBlocks";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Safety reasons — these count toward escalation thresholds
const SAFETY_REASONS = [
  { id: "uncomfortable", label: "Makes me uncomfortable" },
  { id: "inappropriate", label: "Inappropriate behavior" },
  { id: "harassment", label: "Harassment or threats" },
  { id: "spam", label: "Spam or scam" },
] as const;

type BlockMode = "" | "safety" | "personal";

interface BlockButtonProps {
  currentUserId: string;
  targetUserId: string;
  targetDisplayName: string | null;
  onFlag?: () => void;
}

export function BlockButton({
  currentUserId,
  targetUserId,
  targetDisplayName,
  onFlag,
}: BlockButtonProps) {
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [blockMode, setBlockMode] = useState<BlockMode>("");
  const [selectedSafetyReason, setSelectedSafetyReason] = useState("");
  const [details, setDetails] = useState("");

  const firstName = targetDisplayName?.split(" ")[0] || "this person";

  useEffect(() => {
    isBlocked(currentUserId, targetUserId).then((result) => {
      setBlocked(result);
      setLoading(false);
    });
  }, [currentUserId, targetUserId]);

  const handleBlock = async () => {
    setActing(true);

    let reasonText: string;
    if (blockMode === "personal") {
      // Personal preference blocks are prefixed so the escalation trigger can ignore them
      reasonText = `[personal] ${details.trim() || "Personal preference"}`;
    } else {
      const safetyLabel = SAFETY_REASONS.find((r) => r.id === selectedSafetyReason)?.label || selectedSafetyReason;
      reasonText = details.trim()
        ? `${safetyLabel}: ${details.trim()}`
        : safetyLabel;
    }

    const result = await blockUser(currentUserId, targetUserId, reasonText);
    if (result.success) {
      setBlocked(true);
      setShowDialog(false);
      setBlockMode("");
      setSelectedSafetyReason("");
      setDetails("");
      toast("Got it. You'll be notified if they RSVP to your sessions.", {
        description: "They won't know they've been blocked.",
      });
    } else {
      toast.error(result.error || "Could not block.");
    }
    setActing(false);
  };

  const handleUnblock = async () => {
    setActing(true);
    const result = await unblockUser(currentUserId, targetUserId);
    if (result.success) {
      setBlocked(false);
      toast.success("Unblocked. You won't get alerts about this person anymore.");
    } else {
      toast.error(result.error || "Could not unblock.");
    }
    setActing(false);
  };

  const canSubmit = blockMode === "personal" || (blockMode === "safety" && selectedSafetyReason);

  if (loading) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {blocked ? (
            <DropdownMenuItem onClick={handleUnblock} disabled={acting} className="gap-2">
              <ShieldCheck className="w-4 h-4 text-green-600" />
              Unblock {firstName}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => setShowDialog(true)}
              disabled={acting}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <ShieldBan className="w-4 h-4" />
              Block this person
            </DropdownMenuItem>
          )}
          {onFlag && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onFlag} className="gap-2">
                <Flag className="w-4 h-4" />
                Report
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) { setBlockMode(""); setSelectedSafetyReason(""); setDetails(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">Block {firstName}?</DialogTitle>
            <DialogDescription className="text-xs">
              They won't know they're blocked. You'll get a heads-up if they RSVP to your sessions.
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: Choose mode */}
          {!blockMode && (
            <div className="space-y-2 mt-2">
              <p className="text-sm text-muted-foreground">What kind of block?</p>

              <button
                onClick={() => setBlockMode("safety")}
                className="w-full text-left px-3 py-3 rounded-lg border border-border hover:bg-destructive/5 hover:border-destructive/30 transition-all"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <span className="text-sm font-medium text-foreground">Safety concern</span>
                </div>
                <p className="text-[11px] text-muted-foreground ml-6">
                  This person made you feel unsafe or behaved inappropriately.
                  If multiple people report similar concerns, we'll take action.
                </p>
              </button>

              <button
                onClick={() => setBlockMode("personal")}
                className="w-full text-left px-3 py-3 rounded-lg border border-border hover:bg-muted transition-all"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <Heart className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Personal preference</span>
                </div>
                <p className="text-[11px] text-muted-foreground ml-6">
                  You'd rather not see this person at your sessions. No judgment, no consequences for them.
                </p>
              </button>
            </div>
          )}

          {/* Step 2a: Safety reasons */}
          {blockMode === "safety" && (
            <div className="space-y-3 mt-2">
              <p className="text-sm text-muted-foreground">What happened?</p>
              <div className="space-y-1.5">
                {SAFETY_REASONS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedSafetyReason(r.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg border text-sm transition-all",
                      selectedSafetyReason === r.id
                        ? "border-destructive bg-destructive/10 text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <Textarea
                value={details}
                onChange={(e) => setDetails(e.target.value.slice(0, 500))}
                placeholder="Tell us what happened (helps us take the right action)..."
                rows={3}
                maxLength={500}
              />
              <p className="text-[10px] text-muted-foreground">
                Your report is private. If enough people raise similar concerns, we'll review their account.
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setBlockMode(""); setSelectedSafetyReason(""); setDetails(""); }}>Back</Button>
                <Button className="flex-1" variant="destructive" onClick={handleBlock} disabled={!canSubmit || acting}>
                  {acting ? "Blocking..." : "Block & Report"}
                </Button>
              </div>
            </div>
          )}

          {/* Step 2b: Personal preference */}
          {blockMode === "personal" && (
            <div className="space-y-3 mt-2">
              <Textarea
                value={details}
                onChange={(e) => setDetails(e.target.value.slice(0, 300))}
                placeholder="Any notes for yourself? (optional, only you can see this)"
                rows={2}
                maxLength={300}
              />
              <p className="text-[10px] text-muted-foreground">
                This is just for your comfort. It won't affect their account or standing in the community.
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setBlockMode(""); setDetails(""); }}>Back</Button>
                <Button className="flex-1" onClick={handleBlock} disabled={acting}>
                  {acting ? "Blocking..." : "Block"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
