/**
 * @module BlockButton
 * @description Block action with structured reason collection.
 * Blocking is invisible to the blocked person. When a user is blocked by 3+
 * different people, they are auto-flagged for admin review. At 5+ blocks,
 * their account is auto-suspended.
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
import { MoreHorizontal, ShieldBan, ShieldCheck, Flag } from "lucide-react";
import { blockUser, unblockUser, isBlocked } from "@/lib/memberBlocks";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const BLOCK_REASONS = [
  { id: "uncomfortable", label: "Makes me uncomfortable" },
  { id: "inappropriate", label: "Inappropriate behavior" },
  { id: "harassment", label: "Harassment or threats" },
  { id: "spam", label: "Spam or scam" },
  { id: "other", label: "Other" },
] as const;

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
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [extraNotes, setExtraNotes] = useState("");

  useEffect(() => {
    isBlocked(currentUserId, targetUserId).then((result) => {
      setBlocked(result);
      setLoading(false);
    });
  }, [currentUserId, targetUserId]);

  const handleBlockWithReason = async () => {
    setActing(true);
    const reasonText = selectedReason === "other"
      ? extraNotes.trim() || "Other"
      : BLOCK_REASONS.find((r) => r.id === selectedReason)?.label || selectedReason;

    const result = await blockUser(currentUserId, targetUserId, reasonText);
    if (result.success) {
      setBlocked(true);
      setShowReasonDialog(false);
      setSelectedReason("");
      setExtraNotes("");
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
              Unblock {targetDisplayName?.split(" ")[0] || "this person"}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => setShowReasonDialog(true)}
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

      {/* Block reason dialog */}
      <Dialog open={showReasonDialog} onOpenChange={setShowReasonDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">Block {targetDisplayName?.split(" ")[0] || "this person"}?</DialogTitle>
            <DialogDescription className="text-xs">
              They won't know they're blocked. You'll get a heads-up if they RSVP to your sessions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-sm text-muted-foreground">Why are you blocking them?</p>
            <div className="space-y-1.5">
              {BLOCK_REASONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedReason(r.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg border text-sm transition-all",
                    selectedReason === r.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {selectedReason === "other" && (
              <Textarea
                value={extraNotes}
                onChange={(e) => setExtraNotes(e.target.value.slice(0, 200))}
                placeholder="Tell us more (optional)..."
                rows={2}
                maxLength={200}
              />
            )}
            <Button
              className="w-full"
              variant="destructive"
              onClick={handleBlockWithReason}
              disabled={!selectedReason || acting}
            >
              {acting ? "Blocking..." : "Block"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
