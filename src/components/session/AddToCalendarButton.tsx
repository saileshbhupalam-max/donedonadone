import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getGoogleCalendarUrl, downloadICSFile } from "@/lib/calendar";

interface Props {
  event: {
    title: string;
    date: string;
    startTime?: string | null;
    endTime?: string | null;
    venueName?: string | null;
    venueAddress?: string | null;
  };
  size?: "sm" | "default" | "icon";
  variant?: "default" | "outline" | "ghost";
  className?: string;
}

export function AddToCalendarButton({ event, size = "sm", variant = "outline", className }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} variant={variant} className={className}>
          <CalendarPlus className="w-4 h-4" />
          {size !== "icon" && <span className="ml-1.5">Add to Calendar</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => window.open(getGoogleCalendarUrl(event), '_blank')}>
          Google Calendar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadICSFile(event)}>
          Apple / Other Calendar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
