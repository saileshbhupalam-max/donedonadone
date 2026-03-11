import type { Tables } from "@/integrations/supabase/types";

export interface OnboardingData {
  display_name: string;
  avatar_url: string | null;
  tagline: string;
  what_i_do: string;
  work_vibe: string;
  gender: string;
  women_only_interest: boolean;
  noise_preference: string;
  communication_style: string;
  neighborhood: string;
  looking_for: string[];
  can_offer: string[];
  interests: string[];
  linkedin_url: string;
  instagram_handle: string;
  twitter_handle: string;
  phone: string;
  preferred_latitude: number | null;
  preferred_longitude: number | null;
  preferred_radius_km: number;
  preferred_neighborhoods: string[];
  preferred_days: string[];
  preferred_times: string[];
  preferred_session_duration: number;
}

export type ExtendedProfile = Tables<"profiles">;
export type CheckInRecord = Tables<"check_ins">;
export type ConnectionRequest = Tables<"connection_requests">;
export type CoffeeRouletteEntry = Tables<"coffee_roulette_queue">;
export type PartnerApplication = Tables<"partner_applications">;
export type VenueVibe = Tables<"venue_vibes">;

export type CommunityRitual = Tables<"community_rituals"> & {
  participants?: Array<{ user_id: string; ritual_id: string; joined_at?: string | null }>;
};
