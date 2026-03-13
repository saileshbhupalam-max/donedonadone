import { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;

export interface ActivePrompt {
  id: string;
  question: string;
  emoji: string | null;
  response_count: number | null;
  userAnswered: boolean;
}

export interface NextMeetup {
  id: string;
  title: string;
  date: string;
  start_time: string | null;
  venue_name: string | null;
  goingCount: number;
}

export interface PendingFeedback {
  id: string;
  title: string;
  date: string;
}

export interface CommunityStats {
  totalMembers: number;
  promptAnswersThisWeek: number;
  upcomingEvents: number;
}

export interface PostSessionSummary {
  eventTitle: string;
  venueName: string | null;
  hours: number;
  coworkers: string[];
  intention: string | null;
  accomplished: string | null;
  propsReceived: Array<{ prop_type: string; count: number }>;
  streak: number;
  eventId: string;
}

export interface WeeklyDigestData {
  sessions: number;
  hours: number;
  propsGiven: number;
  propsReceived: number;
  streak: number;
  topPercent: number | null;
}
