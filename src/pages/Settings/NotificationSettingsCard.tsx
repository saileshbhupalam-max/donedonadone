import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Bell, Clock, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { UserSettings, NotifPrefs, DEFAULT_NOTIF_PREFS } from "./types";

function NotificationSettingsCard({ settings, settingsLoaded, updateSetting }: {
  settings: UserSettings;
  settingsLoaded: boolean;
  updateSetting: (key: keyof UserSettings, value: any) => void;
}) {
  const { user } = useAuth();
  const { isPushSupported, isPushEnabled, loading: pushLoading, requestPushPermission, unsubscribe } = usePushNotifications();
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setNotifPrefs({
            push_enabled: data.push_enabled ?? true,
            email_enabled: data.email_enabled ?? false,
            whatsapp_enabled: data.whatsapp_enabled ?? false,
            whatsapp_number: data.whatsapp_number ?? "",
            quiet_hours_start: data.quiet_hours_start ?? "22:00",
            quiet_hours_end: data.quiet_hours_end ?? "08:00",
            channels: (data.channels as Record<string, boolean>) ?? DEFAULT_NOTIF_PREFS.channels,
          });
        }
        setPrefsLoaded(true);
      });
  }, [user]);

  const updateNotifPref = async (updates: Partial<NotifPrefs>) => {
    if (!user) return;
    const newPrefs = { ...notifPrefs, ...updates };
    setNotifPrefs(newPrefs);

    const dbUpdate: Record<string, unknown> = {};
    if ("push_enabled" in updates) dbUpdate.push_enabled = updates.push_enabled;
    if ("whatsapp_enabled" in updates) dbUpdate.whatsapp_enabled = updates.whatsapp_enabled;
    if ("whatsapp_number" in updates) dbUpdate.whatsapp_number = updates.whatsapp_number;
    if ("quiet_hours_start" in updates) dbUpdate.quiet_hours_start = updates.quiet_hours_start;
    if ("quiet_hours_end" in updates) dbUpdate.quiet_hours_end = updates.quiet_hours_end;
    if ("channels" in updates) dbUpdate.channels = updates.channels;

    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: user.id, ...dbUpdate }, { onConflict: "user_id" });
    if (error) toast.error("Failed to update preference");
  };

  const toggleChannel = (key: string, value: boolean) => {
    const newChannels = { ...notifPrefs.channels, [key]: value };
    updateNotifPref({ channels: newChannels });
  };

  const handlePushToggle = async (enabled: boolean) => {
    if (enabled) {
      const success = await requestPushPermission();
      if (!success) toast.error("Could not enable push notifications. Please allow notifications in your browser settings.");
      else {
        toast.success("Push notifications enabled!");
        updateNotifPref({ push_enabled: true });
      }
    } else {
      await unsubscribe();
      toast.success("Push notifications disabled");
      updateNotifPref({ push_enabled: false });
    }
  };

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <h2 className="font-serif text-base text-foreground">Notifications</h2>

        {/* Push master toggle */}
        {isPushSupported && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Push notifications</span>
              </div>
              <Switch
                checked={isPushEnabled}
                onCheckedChange={handlePushToggle}
                disabled={pushLoading}
              />
            </div>
            <p className="text-[10px] text-muted-foreground -mt-2">Get notified even when the app is closed</p>
            <Separator />
          </>
        )}

        {/* Category toggles */}
        <p className="text-xs font-medium text-muted-foreground">Categories</p>
        {[
          { key: "session_reminders", label: "Session reminders" },
          { key: "streak_warnings", label: "Streak warnings" },
          { key: "weekly_digest", label: "Weekly digest" },
          { key: "connection_updates", label: "Connection updates" },
          { key: "community_updates", label: "Community updates" },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-sm text-foreground">{label}</span>
            <Switch
              checked={notifPrefs.channels[key] !== false}
              onCheckedChange={(v) => toggleChannel(key, v)}
              disabled={!prefsLoaded}
            />
          </div>
        ))}

        <Separator />

        {/* In-app notification toggles (legacy user_settings) */}
        <p className="text-xs font-medium text-muted-foreground">In-app alerts</p>
        {[
          { key: "notify_connection_requests" as const, label: "Connection requests" },
          { key: "notify_micro_requests" as const, label: "Micro-request updates" },
          { key: "notify_coffee_matches" as const, label: "Coffee match alerts" },
          { key: "notify_props" as const, label: "Props received" },
          { key: "notify_system" as const, label: "System notifications" },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-sm text-foreground">{label}</span>
            <Switch
              checked={settings[key] as boolean}
              onCheckedChange={(v) => updateSetting(key, v)}
              disabled={!settingsLoaded}
            />
          </div>
        ))}

        <Separator />

        {/* Quiet hours */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Quiet hours</span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="time"
              value={notifPrefs.quiet_hours_start}
              onChange={(e) => updateNotifPref({ quiet_hours_start: e.target.value })}
              className="w-28"
              disabled={!prefsLoaded}
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="time"
              value={notifPrefs.quiet_hours_end}
              onChange={(e) => updateNotifPref({ quiet_hours_end: e.target.value })}
              className="w-28"
              disabled={!prefsLoaded}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">No push or WhatsApp during these hours</p>
        </div>

        <Separator />

        {/* WhatsApp */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">WhatsApp notifications</span>
            </div>
            <Switch
              checked={notifPrefs.whatsapp_enabled}
              onCheckedChange={(v) => updateNotifPref({ whatsapp_enabled: v })}
              disabled={!prefsLoaded}
            />
          </div>
          {notifPrefs.whatsapp_enabled && (
            <>
              <Input
                value={notifPrefs.whatsapp_number}
                onChange={(e) => updateNotifPref({ whatsapp_number: e.target.value })}
                placeholder="+91XXXXXXXXXX"
                className="w-48"
              />
              <p className="text-[10px] text-destructive/70">WhatsApp notifications coming soon</p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default NotificationSettingsCard;
