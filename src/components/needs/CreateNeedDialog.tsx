import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserContext } from "@/hooks/useUserContext";
import { supabase } from "@/integrations/supabase/client";
import { serializeNeedMeta, BUDGET_OPTIONS, DURATION_OPTIONS, NEED_CATEGORIES, type NeedMeta } from "@/lib/needsMatch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

interface CreateNeedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function CreateNeedDialog({ open, onOpenChange, onCreated }: CreateNeedDialogProps) {
  const { user } = useAuth();
  const { activeCheckIn } = useUserContext();

  const [isOffer, setIsOffer] = useState(false);
  const [category, setCategory] = useState("skill_help");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [duration, setDuration] = useState("");
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleAddSkill = () => {
    const trimmed = skillInput.trim().toLowerCase();
    if (trimmed && !skills.includes(trimmed) && skills.length < 10) {
      setSkills([...skills, trimmed]);
      setSkillInput("");
    }
  };

  const handleSkillKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddSkill();
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setSkills(skills.filter(s => s !== skill));
  };

  const resetForm = () => {
    setIsOffer(false);
    setCategory("skill_help");
    setTitle("");
    setDescription("");
    setBudget("");
    setDuration("");
    setSkillInput("");
    setSkills([]);
  };

  const handleSubmit = async () => {
    if (!user || !title.trim()) return;

    setSubmitting(true);

    const meta: NeedMeta = {
      is_offer: isOffer,
      ...(budget && { budget }),
      ...(duration && { duration }),
      ...(skills.length > 0 && { skills }),
    };

    const fullDescription = serializeNeedMeta(description.trim(), meta);

    const { error } = await supabase.from("micro_requests").insert({
      user_id: user.id,
      location_id: activeCheckIn?.location_id || null,
      request_type: category,
      title: title.trim(),
      description: fullDescription || null,
    });

    if (error) {
      toast.error("Failed to post. Please try again.");
      setSubmitting(false);
      return;
    }

    toast.success(isOffer ? "Offer posted!" : "Need posted!");
    resetForm();
    setSubmitting(false);
    onOpenChange(false);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg">
            {isOffer ? "Post an Offer" : "Post a Need"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {isOffer
              ? "Let the community know what you can help with."
              : "Describe what you need -- the right people will find you."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Type toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
            <div>
              <Label className="text-sm font-medium">
                {isOffer ? "I can offer..." : "I need..."}
              </Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Toggle to switch between need and offer
              </p>
            </div>
            <Switch checked={isOffer} onCheckedChange={setIsOffer} />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(NEED_CATEGORIES).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Title</Label>
            <Input
              placeholder={isOffer ? "What can you offer?" : "What do you need?"}
              value={title}
              onChange={e => setTitle(e.target.value.slice(0, 100))}
              maxLength={100}
              className="text-sm"
            />
            <p className="text-[10px] text-muted-foreground text-right">{title.length}/100</p>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Description</Label>
            <Textarea
              placeholder="More details about what you need or can offer..."
              value={description}
              onChange={e => setDescription(e.target.value.slice(0, 500))}
              maxLength={500}
              className="text-sm min-h-[80px]"
            />
            <p className="text-[10px] text-muted-foreground text-right">{description.length}/500</p>
          </div>

          {/* Budget */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Budget Range (optional)</Label>
            <Select value={budget} onValueChange={setBudget}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select budget range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No budget specified</SelectItem>
                {BUDGET_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Duration */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Duration (optional)</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No duration specified</SelectItem>
                {DURATION_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Skills tags */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Skills / Tags (optional)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Type a skill and press Enter"
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={handleSkillKeyDown}
                className="text-sm flex-1"
              />
              <Button type="button" size="sm" variant="outline" onClick={handleAddSkill} disabled={!skillInput.trim()}>
                Add
              </Button>
            </div>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {skills.map(skill => (
                  <Badge key={skill} variant="secondary" className="text-xs gap-1 pr-1">
                    {skill}
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill)}
                      className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">{skills.length}/10 tags</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!title.trim() || submitting}
          >
            {submitting && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
            {isOffer ? "Post Offer" : "Post Need"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
