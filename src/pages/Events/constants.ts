import { parseISO, isTomorrow, differenceInDays, differenceInHours, format } from "date-fns";

export const NEIGHBORHOODS = [
  { value: "hsr_layout", label: "HSR Layout" },
  { value: "koramangala", label: "Koramangala" },
  { value: "indiranagar", label: "Indiranagar" },
  { value: "jayanagar", label: "Jayanagar" },
  { value: "whitefield", label: "Whitefield" },
  { value: "electronic_city", label: "Electronic City" },
];

export const SESSION_FORMATS = [
  { value: "all_formats", label: "All Formats" },
  { value: "casual", label: "Casual" },
  { value: "structured_2hr", label: "Structured 2hr" },
  { value: "structured_4hr", label: "Structured 4hr" },
  { value: "focus_only_2hr", label: "Focus Only 2hr" },
  { value: "focus_only_4hr", label: "Focus Only 4hr" },
];

export const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
export const DAY_LABELS: Record<string, string> = { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun" };

export function getNeighborhoodLabel(value: string | null) {
  return NEIGHBORHOODS.find((n) => n.value === value)?.label || value || "";
}

export function getTimingLabel(dateStr: string) {
  const date = parseISO(dateStr);
  if (isTomorrow(date)) return "Tomorrow!";
  const days = differenceInDays(date, new Date());
  if (days === 0) return "Today!";
  if (days > 0 && days <= 7) return `In ${days} day${days > 1 ? "s" : ""}`;
  if (days > 7) return format(date, "EEE, MMM d");
  return null;
}

export function isWithin48Hours(dateStr: string) {
  const eventDate = parseISO(dateStr);
  const hours = differenceInHours(eventDate, new Date());
  return hours >= 0 && hours <= 48;
}
