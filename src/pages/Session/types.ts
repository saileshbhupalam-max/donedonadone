import { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;

export interface Phase {
  id: string;
  phase_order: number;
  phase_type: string;
  phase_label: string;
  duration_minutes: number;
}

export interface MemberStatusRow {
  user_id: string;
  status: string;
  until_time: string | null;
  topic: string | null;
  profile?: Profile;
}
