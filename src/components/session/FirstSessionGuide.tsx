import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronUp } from "lucide-react";

export function FirstSessionGuide() {
  const [open, setOpen] = useState(true);

  return (
    <Card className="border-secondary/20 bg-secondary/5">
      <CardContent className="p-4 space-y-2">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center justify-between w-full text-left"
        >
          <p className="font-serif text-sm text-foreground">{"\u{1F331}"} Your first session? Here's what to expect</p>
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {open && (
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">{"\u{1F4CB}"} How it works</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Check in {"\u{2192}"} Icebreaker {"\u{2192}"} Deep work {"\u{2192}"} Social break {"\u{2192}"} Wrap up
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">{"\u{1F6A6}"} Traffic light status</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Set your status so others know when to chat.{" "}
                <span className="inline-block w-2 h-2 rounded-full bg-red-500 align-middle" /> Focus{" "}
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400 align-middle" /> Open to chat{" "}
                <span className="inline-block w-2 h-2 rounded-full bg-green-500 align-middle" /> Social
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">{"\u{1F389}"} After the session</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Rate the session, give props to your tablemates, and save the memory.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
