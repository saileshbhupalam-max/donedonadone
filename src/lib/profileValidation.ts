/**
 * Profile field validation utilities.
 * Used before Supabase profile upsert/update calls to enforce
 * client-side constraints on user-editable fields.
 */

/** Strip HTML tags from a string. */
function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, "");
}

/** Clamp a number between min and max. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Truncate a string to maxLen characters. */
function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

// --- Individual field validators ---

export function validateDisplayName(name: string): string {
  return truncate(stripHtml(name).trim(), 50);
}

export function validateBio(bio: string): string {
  return truncate(stripHtml(bio).trim(), 500);
}

export function validateTagline(tagline: string): string {
  return truncate(stripHtml(tagline).trim(), 120);
}

export function validateWhatIDo(text: string): string {
  return truncate(stripHtml(text).trim(), 200);
}

export function validatePreferredRadiusKm(value: number): number {
  return clamp(value, 0.5, 50);
}

export function validateAutopilotMaxPerWeek(value: number): number {
  return clamp(Math.round(value), 1, 14);
}

export function validateFocusHours(value: number): number {
  return clamp(value, 0, 10000);
}

export function validateLookingFor(items: string[]): string[] {
  return items.map((s) => truncate(stripHtml(s).trim(), 100)).filter(Boolean).slice(0, 20);
}

export function validateCanOffer(items: string[]): string[] {
  return items.map((s) => truncate(stripHtml(s).trim(), 100)).filter(Boolean).slice(0, 20);
}

export function validateInterests(items: string[]): string[] {
  return items.map((s) => truncate(stripHtml(s).trim(), 50)).filter(Boolean).slice(0, 30);
}

export function validatePhone(phone: string): string {
  return truncate(phone.trim(), 20);
}

export function validateUrl(url: string): string {
  return truncate(url.trim(), 500);
}

export function validateNeighborhood(neighborhood: string): string {
  return truncate(stripHtml(neighborhood).trim(), 100);
}

/**
 * Sanitize a full profile data object before sending to Supabase.
 * Only validates fields that are present in the object — does not
 * add missing fields.
 */
export function sanitizeProfileData(data: Record<string, any>): Record<string, any> {
  const result = { ...data };

  if (typeof result.display_name === "string") {
    result.display_name = validateDisplayName(result.display_name);
  }
  if (typeof result.bio === "string") {
    result.bio = validateBio(result.bio);
  }
  if (typeof result.tagline === "string") {
    result.tagline = validateTagline(result.tagline);
  }
  if (typeof result.what_i_do === "string") {
    result.what_i_do = validateWhatIDo(result.what_i_do);
  }
  if (typeof result.neighborhood === "string") {
    result.neighborhood = validateNeighborhood(result.neighborhood);
  }
  if (typeof result.preferred_radius_km === "number") {
    result.preferred_radius_km = validatePreferredRadiusKm(result.preferred_radius_km);
  }
  if (typeof result.autopilot_max_per_week === "number") {
    result.autopilot_max_per_week = validateAutopilotMaxPerWeek(result.autopilot_max_per_week);
  }
  if (typeof result.focus_hours === "number") {
    result.focus_hours = validateFocusHours(result.focus_hours);
  }
  if (Array.isArray(result.looking_for)) {
    result.looking_for = validateLookingFor(result.looking_for);
  }
  if (Array.isArray(result.can_offer)) {
    result.can_offer = validateCanOffer(result.can_offer);
  }
  if (Array.isArray(result.interests)) {
    result.interests = validateInterests(result.interests);
  }
  if (typeof result.phone === "string") {
    result.phone = validatePhone(result.phone);
  }
  if (typeof result.linkedin_url === "string") {
    result.linkedin_url = validateUrl(result.linkedin_url);
  }
  if (typeof result.instagram_handle === "string") {
    result.instagram_handle = truncate(stripHtml(result.instagram_handle).trim(), 100);
  }
  if (typeof result.twitter_handle === "string") {
    result.twitter_handle = truncate(stripHtml(result.twitter_handle).trim(), 100);
  }

  return result;
}
