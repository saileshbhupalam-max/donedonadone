/**
 * Pure functions extracted from the send-notification Edge Function
 * for testability. Mirrors the quiet hours and channel routing logic.
 */

export interface NotificationPrefs {
  push_enabled: boolean;
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  whatsapp_number: string | null;
  quiet_hours_start: string; // "HH:MM"
  quiet_hours_end: string;   // "HH:MM"
  channels: Record<string, boolean>;
}

export function isInQuietHours(
  currentMinutesIST: number,
  quietStart: string,
  quietEnd: string
): boolean {
  const [qsH, qsM] = quietStart.split(":").map(Number);
  const [qeH, qeM] = quietEnd.split(":").map(Number);
  const qsMin = qsH * 60 + qsM;
  const qeMin = qeH * 60 + qeM;

  if (qsMin > qeMin) {
    // Overnight (e.g. 22:00 - 08:00)
    return currentMinutesIST >= qsMin || currentMinutesIST < qeMin;
  } else {
    // Same day (e.g. 00:00 - 06:00)
    return currentMinutesIST >= qsMin && currentMinutesIST < qeMin;
  }
}

export function isCategoryEnabled(
  category: string,
  channels: Record<string, boolean> | null
): boolean {
  if (!channels) return true; // Default to enabled if no prefs
  return channels[category] !== false; // Missing = enabled
}

export interface ChannelDecision {
  inApp: boolean;     // always true
  push: boolean;
  whatsapp: boolean;
}

export function resolveChannels(
  prefs: NotificationPrefs | null,
  category: string,
  currentMinutesIST: number,
  hasActivePushTokens: boolean
): ChannelDecision {
  const result: ChannelDecision = {
    inApp: true,
    push: false,
    whatsapp: false,
  };

  if (!prefs) return result;

  const categoryEnabled = isCategoryEnabled(category, prefs.channels);
  const inQuiet = isInQuietHours(currentMinutesIST, prefs.quiet_hours_start, prefs.quiet_hours_end);

  // Push: enabled + not quiet + category on + has tokens
  if (!inQuiet && categoryEnabled && prefs.push_enabled && hasActivePushTokens) {
    result.push = true;
  }

  // WhatsApp: enabled + not quiet + category on + has number
  if (!inQuiet && categoryEnabled && prefs.whatsapp_enabled && prefs.whatsapp_number) {
    result.whatsapp = true;
  }

  return result;
}
