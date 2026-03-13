import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Shuffle, Save, X } from "lucide-react";
import { useState } from "react";

export interface GroupMember {
  id: string;
  display_name?: string;
  gender?: string | null;
  events_attended?: number;
  is_table_captain?: boolean;
}

interface GroupPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: any;
  groups: GroupMember[][];
  onConfirm: () => Promise<void>;
  onShuffle: () => void;
}

function genderLabel(gender: string | null | undefined): string | null {
  if (!gender) return null;
  if (gender === "woman" || gender === "female") return "W";
  if (gender === "man" || gender === "male") return "M";
  return gender.charAt(0).toUpperCase();
}

function getStats(groups: GroupMember[][]) {
  const totalMembers = groups.reduce((sum, g) => sum + g.length, 0);
  const avgSize = groups.length > 0 ? (totalMembers / groups.length).toFixed(1) : "0";

  let women = 0;
  let men = 0;
  let captains = 0;
  let groupsWithCaptain = 0;

  for (const group of groups) {
    let hasCaptain = false;
    for (const m of group) {
      if (m.gender === "woman" || m.gender === "female") women++;
      if (m.gender === "man" || m.gender === "male") men++;
      if (m.is_table_captain) {
        captains++;
        hasCaptain = true;
      }
    }
    if (hasCaptain) groupsWithCaptain++;
  }

  return { totalMembers, avgSize, women, men, captains, groupsWithCaptain };
}

export function GroupPreviewModal({
  open,
  onOpenChange,
  event,
  groups,
  onConfirm,
  onShuffle,
}: GroupPreviewModalProps) {
  const [saving, setSaving] = useState(false);
  const stats = getStats(groups);

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Group Preview: {event?.title}</DialogTitle>
          <DialogDescription className="text-xs">
            Review groups before saving. Shuffle to regenerate.
          </DialogDescription>
        </DialogHeader>

        {/* Stats bar */}
        <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          <Badge variant="outline" className="text-[10px]">
            {groups.length} groups
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            Avg size: {stats.avgSize}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {stats.women}W / {stats.men}M
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {stats.groupsWithCaptain}/{groups.length} have captain
          </Badge>
        </div>

        {/* Group cards */}
        <div className="space-y-2">
          {groups.map((group, i) => (
            <Card key={i} className="border">
              <CardContent className="p-3">
                <p className="text-xs font-medium mb-1.5">
                  Table {i + 1}{" "}
                  <span className="text-muted-foreground font-normal">
                    ({group.length} members)
                  </span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.map((m) => (
                    <Badge
                      key={m.id}
                      variant={m.is_table_captain ? "default" : "secondary"}
                      className="text-[10px] gap-1"
                    >
                      {m.is_table_captain && (
                        <span title="Table Captain" className="text-amber-400">
                          *
                        </span>
                      )}
                      {m.display_name || "Member"}
                      {genderLabel(m.gender) && (
                        <span className="opacity-60">{genderLabel(m.gender)}</span>
                      )}
                      {m.events_attended != null && (
                        <span className="opacity-50">({m.events_attended})</span>
                      )}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={onShuffle}
            disabled={saving}
          >
            <Shuffle className="w-3 h-3 mr-1" /> Shuffle
          </Button>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              <X className="w-3 h-3 mr-1" /> Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs"
              onClick={handleConfirm}
              disabled={saving}
            >
              <Save className="w-3 h-3 mr-1" />
              {saving ? "Saving..." : "Save Groups"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
