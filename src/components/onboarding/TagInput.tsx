import { useState } from "react";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
  variant: "primary" | "secondary";
  placeholder?: string;
}

export function TagInput({ label, tags, onChange, suggestions, variant, placeholder }: Props) {
  const [input, setInput] = useState("");

  const addTag = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      onChange([...tags, t]);
    }
    setInput("");
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(input);
    }
  };

  const unusedSuggestions = suggestions.filter((s) => !tags.includes(s));

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">{label}</label>

      {/* Selected tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className={cn(
                "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium",
                variant === "primary"
                  ? "bg-primary/15 text-primary"
                  : "bg-secondary/15 text-secondary"
              )}
            >
              {tag}
              <button onClick={() => removeTag(tag)} className="hover:opacity-70">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="rounded-xl"
      />

      {/* Suggestions */}
      {unusedSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {unusedSuggestions.map((s) => (
            <button
              key={s}
              onClick={() => addTag(s)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                variant === "primary"
                  ? "border-primary/30 text-primary hover:bg-primary/10"
                  : "border-secondary/30 text-secondary hover:bg-secondary/10"
              )}
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
