export interface UserSettings {
  notify_connection_requests: boolean;
  notify_micro_requests: boolean;
  notify_coffee_matches: boolean;
  notify_props: boolean;
  notify_system: boolean;
  weekly_goal: number;
  visibility: string;
}

export const DEFAULT_SETTINGS: UserSettings = {
  notify_connection_requests: true,
  notify_micro_requests: true,
  notify_coffee_matches: true,
  notify_props: true,
  notify_system: true,
  weekly_goal: 3,
  visibility: "everyone",
};

export interface NotifPrefs {
  push_enabled: boolean;
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  whatsapp_number: string;
  quiet_hours_start: string;
  quiet_hours_end: string;
  silent_days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  channels: Record<string, boolean>;
}

export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  push_enabled: true,
  email_enabled: false,
  whatsapp_enabled: false,
  whatsapp_number: "",
  quiet_hours_start: "22:00",
  quiet_hours_end: "08:00",
  silent_days: [],
  channels: {
    session_reminders: true,
    streak_warnings: true,
    weekly_digest: true,
    connection_updates: true,
    community_updates: true,
    upgrade_prompts: false,
  },
};
