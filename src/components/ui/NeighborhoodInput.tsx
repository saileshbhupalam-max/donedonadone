/**
 * Autocomplete input for neighborhoods. Suggests from existing neighborhoods
 * in the DB but allows free text for new areas (international expansion).
 *
 * When a user types a new neighborhood that doesn't exist, it gets normalized
 * and added to the system on save.
 */
import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useNeighborhoods,
  normalizeNeighborhood,
  displayNeighborhood,
  type NeighborhoodOption,
} from "@/lib/neighborhoods";

interface NeighborhoodInputProps {
  value: string; // slug or display name
  onChange: (slug: string, display: string) => void;
  placeholder?: string;
  className?: string;
}

export function NeighborhoodInput({
  value,
  onChange,
  placeholder = "Type your neighborhood...",
  className,
}: NeighborhoodInputProps) {
  const { neighborhoods, search } = useNeighborhoods();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<NeighborhoodOption[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Resolve display name from slug on mount
  useEffect(() => {
    if (value && !query) {
      const match = neighborhoods.find((n) => n.slug === value || n.display === value);
      setQuery(match?.display || displayNeighborhood(value));
    }
  }, [value, neighborhoods]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleInputChange = (text: string) => {
    setQuery(text);
    const results = search(text);
    setSuggestions(results.slice(0, 8));
    setOpen(text.length > 0 && results.length > 0);
  };

  const handleSelect = (option: NeighborhoodOption) => {
    setQuery(option.display);
    onChange(option.slug, option.display);
    setOpen(false);
  };

  const handleBlur = () => {
    // On blur, if no match selected, normalize the free text as a new neighborhood
    setTimeout(() => {
      if (!open && query.trim()) {
        const match = neighborhoods.find(
          (n) => n.display.toLowerCase() === query.trim().toLowerCase()
        );
        if (match) {
          onChange(match.slug, match.display);
        } else {
          // New neighborhood — normalize it
          const slug = normalizeNeighborhood(query);
          if (slug) {
            onChange(slug, query.trim());
          }
        }
      }
    }, 150);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            const results = search(query);
            setSuggestions(results.slice(0, 8));
            if (results.length > 0) setOpen(true);
          }}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={cn("pl-9", className)}
        />
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((option) => (
            <button
              key={option.slug}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors first:rounded-t-lg last:rounded-b-lg"
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur before click fires
                handleSelect(option);
              }}
            >
              {option.display}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
