import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Camera, LogOut, Trash2, ExternalLink, Minus, Plus, Bell, Building2, Zap, CreditCard, MessageSquare, Clock } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { usePageTitle } from "@/hooks/usePageTitle";
import { getInitials } from "@/lib/utils";
import { motion } from "framer-motion";
import { CONFIRMATIONS, ERROR_STATES } from "@/lib/personality";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface UserSettings {
  notify_connection_requests: boolean;
  notify_micro_requests: boolean;
  notify_coffee_matches: boolean;
  notify_props: boolean;
  notify_system: boolean;
  weekly_goal: number;
  visibility: string;
}

const DEFAULT_SETTINGS: UserSettings = {
  notify_connection_requests: true,
  notify_micro_requests: true,
  notify_coffee_matches: true,
  notify_props: true,
  notify_system: true,
  weekly_goal: 3,
  visibility: "everyone",
};

interface NotifPrefs {
  push_enabled: boolean;
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  whatsapp_number: string;
  quiet_hours_start: string;
  quiet_hours_end: string;
  channels: Record<string, boolean>;
}

const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  push_enabled: true,
  email_enabled: false,
  whatsapp_enabled: false,
  whatsapp_number: "",
  quiet_hours_start: "22:00",
  quiet_hours_end: "08:00",
  channels: {
    session_reminders: true,
    streak_warnings: true,
    weekly_digest: true,
    connection_updates: true,
    community_updates: true,
    upgrade_prompts: false,
  },
};

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

function SubscriptionCard() {
  const { tierName, isBoosted } = useSubscription();
  const navigate = useNavigate();

  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <h2 className="font-serif text-base text-foreground">Subscription</h2>
        <button
          onClick={() => navigate("/pricing")}
          className="flex items-center gap-3 w-full p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
        >
          <CreditCard className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
              {tierName}
              {isBoosted && <Zap className="w-3.5 h-3.5 text-primary" />}
            </p>
            <p className="text-[10px] text-muted-foreground">View plans & upgrade</p>
          </div>
          <ExternalLink className="w-4 h-4 text-muted-foreground" />
        </button>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  usePageTitle("Settings — FocusClub");
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [myCompany, setMyCompany] = useState<{ company_id: string; name: string; role: string } | null>(null);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? "");
    setBio(profile.bio ?? "");
    setAvatarUrl(profile.avatar_url ?? "");
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSettings({
            notify_connection_requests: data.notify_connection_requests,
            notify_micro_requests: data.notify_micro_requests,
            notify_coffee_matches: data.notify_coffee_matches,
            notify_props: data.notify_props,
            notify_system: data.notify_system,
            weekly_goal: data.weekly_goal,
            visibility: data.visibility,
          });
        }
        setSettingsLoaded(true);
      });
    // Fetch company membership
    supabase
      .from("company_members")
      .select("company_id, role, companies(name)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setMyCompany({
            company_id: data.company_id,
            role: data.role,
            name: (data.companies as { name: string } | null)?.name || "My Company",
          });
        }
      });
  }, [user]);

  const updateSetting = useCallback(async (key: keyof UserSettings, value: any) => {
    if (!user) return;
    setSettings((prev) => ({ ...prev, [key]: value }));
    const { error } = await supabase
      .from("user_settings")
      .update({ [key]: value })
      .eq("user_id", user.id);
    if (error) {
      toast.error("Failed to update setting");
      const { data } = await supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle();
      if (data) setSettings(data as UserSettings);
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user || !displayName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      display_name: displayName.trim(),
      bio: bio.trim() || null,
    }).eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(ERROR_STATES.generic); return; }
    toast.success(CONFIRMATIONS.profileSaved);
    refreshProfile();
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) { toast.error("Upload failed"); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const newUrl = urlData.publicUrl + "?t=" + Date.now();
    await supabase.from("profiles").update({ avatar_url: newUrl }).eq("id", user.id);
    setAvatarUrl(newUrl);
    setUploading(false);
    toast.success("Avatar updated!");
    refreshProfile();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const initials = getInitials(displayName || profile?.display_name);

  return (
    <AppShell>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="max-w-lg mx-auto px-4 pt-4 pb-28 space-y-6"
      >
        <h1 className="font-serif text-2xl text-foreground">Settings</h1>

        {/* ═══ Section 1: Profile ═══ */}
        <Card>
          <CardContent className="pt-5 space-y-4">
            <h2 className="font-serif text-base text-foreground">Profile</h2>

            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={avatarUrl || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg">{initials}</AvatarFallback>
                </Avatar>
                <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors">
                  <Camera className="w-3.5 h-3.5" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
                </label>
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Display name</Label>
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1" />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Bio</Label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 200))}
                maxLength={200}
                placeholder="Tell people a bit about yourself..."
                className="mt-1 min-h-[60px]"
              />
              <p className="text-[10px] text-muted-foreground mt-1 text-right">{bio.length}/200</p>
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveProfile} disabled={saving || !displayName.trim()}>
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate(`/profile/${user?.id}`)}>
                <ExternalLink className="w-3.5 h-3.5 mr-1" /> View my profile
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ═══ Section: Subscription ═══ */}
        <SubscriptionCard />

        {/* ═══ Section 2: My Company ═══ */}
        <Card>
          <CardContent className="pt-5 space-y-3">
            <h2 className="font-serif text-base text-foreground">My Company</h2>
            {myCompany ? (
              <Link
                to={`/company/${myCompany.company_id}`}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                <Building2 className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{myCompany.name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{myCompany.role}</p>
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </Link>
            ) : (
              <Button variant="outline" className="w-full gap-2" onClick={() => navigate("/company/create")}>
                <Building2 className="w-4 h-4" /> Create Company
              </Button>
            )}
          </CardContent>
        </Card>

        {/* ═══ Section 3: Notifications ═══ */}
        <NotificationSettingsCard settings={settings} settingsLoaded={settingsLoaded} updateSetting={updateSetting} />

        {/* ═══ Section 3: Preferences ═══ */}
        <Card>
          <CardContent className="pt-5 space-y-5">
            <h2 className="font-serif text-base text-foreground">Preferences</h2>

            <div className="space-y-2">
              <Label className="text-sm text-foreground">Weekly check-in goal</Label>
              <div className="flex items-center gap-3">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  disabled={settings.weekly_goal <= 1}
                  onClick={() => updateSetting("weekly_goal", settings.weekly_goal - 1)}
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="text-lg font-medium text-foreground w-8 text-center">{settings.weekly_goal}</span>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  disabled={settings.weekly_goal >= 7}
                  onClick={() => updateSetting("weekly_goal", settings.weekly_goal + 1)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
                <span className="text-xs text-muted-foreground">days per week</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="text-sm text-foreground">Profile visibility</Label>
              <RadioGroup
                value={settings.visibility}
                onValueChange={(v) => updateSetting("visibility", v)}
              >
                {[
                  { value: "everyone", label: "Everyone", desc: "Visible in Who's Here and Discover" },
                  { value: "connections_only", label: "Connections only", desc: "Only visible to people you're connected with" },
                  { value: "hidden", label: "Hidden", desc: "Not visible to anyone (you can still check in)" },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <RadioGroupItem value={opt.value} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        {/* ═══ Section 4: Account ═══ */}
        <Card>
          <CardContent className="pt-5 space-y-4">
            <h2 className="font-serif text-base text-foreground">Account</h2>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full gap-2">
                  <LogOut className="w-4 h-4" /> Sign out
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sign out?</AlertDialogTitle>
                  <AlertDialogDescription>You'll need to sign in again to access FocusClub.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Never mind</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSignOut}>Sign Out</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="w-full gap-2 text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4" /> Delete account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>This action cannot be undone. All your data will be permanently removed.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => toast.info("Contact support to delete your account")}>
                    I understand, delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </motion.div>
    </AppShell>
  );
}
