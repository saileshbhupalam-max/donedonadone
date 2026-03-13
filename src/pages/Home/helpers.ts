import type { Profile } from "./types";

export function getFirstName(name: string | null) {
  return name?.split(" ")[0] || "there";
}

export function getNextAction(p: Profile): string | null {
  if (!p.what_i_do) return "Add what you do to reach higher completion";
  if (!p.display_name) return "Add your name";
  if (!p.avatar_url) return "Upload a profile photo";
  if (!p.tagline) return "Add a tagline";
  if ((p.looking_for ?? []).length === 0) return "Add what you're looking for";
  if ((p.can_offer ?? []).length === 0) return "Share what you can offer";
  if (!p.linkedin_url && !p.instagram_handle && !p.twitter_handle) return "Add a social link";
  if ((p.interests ?? []).length === 0) return "Add your interests";
  if (!p.work_vibe) return "Set your work vibe";
  if (!p.gender) return "Set your gender";
  if (!p.neighborhood) return "Pick your neighborhood";
  return null;
}
