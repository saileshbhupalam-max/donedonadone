import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { getInitials } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Tables } from "@/integrations/supabase/types";
import { checkAndAwardBadges } from "@/lib/badges";
import { trackAnalyticsEvent } from "@/lib/growth";
import { ERROR_STATES, CONFIRMATIONS } from "@/lib/personality";
import { hapticLight } from "@/lib/haptics";

type Profile = Tables<"profiles">;

export const PROP_TYPES = [
  { type: "energy", emoji: "⚡", label: "Great energy" },
  { type: "helpful", emoji: "🤝", label: "Super helpful" },
  { type: "focused", emoji: "🎯", label: "Infectious focus" },
  { type: "inspiring", emoji: "💡", label: "Really inspiring" },
  { type: "fun", emoji: "🎉", label: "Made it fun" },
  { type: "kind", emoji: "💛", label: "So welcoming" },
] as const;

const MAX_PROPS = 5;

interface GivePropsFlowProps {
  eventId: string;
  onDone: () => void;
}

interface PendingProp {
  toUser: string;
  propType: string;
}

export function GivePropsFlow({ eventId, onDone }: GivePropsFlowProps) {
  const { user } = useAuth();
  const [attendees, setAttendees] = useState<Profile[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [pendingProps, setPendingProps] = useState<PendingProp[]>([]);
  const [anonymous, setAnonymous] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: rsvps } = await supabase
        .from("event_rsvps")
        .select("user_id")
        .eq("event_id", eventId)
        .eq("status", "going");
      if (!rsvps) return;
      const userIds = rsvps.map(r => r.user_id).filter(id => id !== user.id);
      if (userIds.length === 0) return;
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", userIds);
      setAttendees(profiles || []);
    })();
  }, [eventId, user]);

  const remaining = MAX_PROPS - pendingProps.length;
  const personProps = (userId: string) => pendingProps.filter(p => p.toUser === userId);

  const toggleProp = (toUser: string, propType: string) => {
    const exists = pendingProps.find(p => p.toUser === toUser && p.propType === propType);
    if (exists) {
      setPendingProps(prev => prev.filter(p => !(p.toUser === toUser && p.propType === propType)));
    } else if (remaining > 0) {
      setPendingProps(prev => [...prev, { toUser, propType }]);
    }
  };

  const handleSubmit = async () => {
    if (!user || pendingProps.length === 0) { onDone(); return; }
    setSaving(true);
    try {
      /* DESIGN: 30% of props become "echoes" — delayed delivery creates
         intermittent reinforcement, forming stronger emotional bonds.
         The recipient gets a warm surprise hours later. */
      const inserts = pendingProps.map(p => {
        const isEcho = Math.random() < 0.3;
        return {
          from_user: user.id,
          to_user: p.toUser,
          event_id: eventId,
          prop_type: p.propType,
          anonymous,
          is_echo: isEcho,
          delivered_at: isEcho ? null : new Date().toISOString(),
          echo_deliver_at: isEcho
            ? new Date(Date.now() + (4 + Math.random() * 20) * 60 * 60 * 1000).toISOString()
            : null,
        };
      });
      const { error } = await supabase.from("peer_props").insert(inserts);
      if (error) throw error;

      // Create notifications for each recipient
      const recipientMap = new Map<string, string[]>();
      pendingProps.forEach(p => {
        if (!recipientMap.has(p.toUser)) recipientMap.set(p.toUser, []);
        recipientMap.get(p.toUser)!.push(p.propType);
      });

      const { data: myProfile } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();
      const myName = myProfile?.display_name || "Someone";

      for (const [toUser, types] of recipientMap) {
        const propDef = PROP_TYPES.find(p => p.type === types[0]);
        const notifTitle = anonymous
          ? `Someone gave you ${propDef?.emoji} Props for ${propDef?.label.toLowerCase()}!`
          : `${myName} thinks you're ${propDef?.emoji} ${propDef?.label.toLowerCase()}!`;
        await supabase.rpc("create_system_notification", {
          p_user_id: toUser,
          p_title: notifTitle,
          p_body: types.length > 1 ? `+${types.length - 1} more props` : null,
          p_type: "props_received",
          p_link: "/me",
        });

        // Check badges for the recipient
        const { data: recipientProfile } = await supabase.from("profiles").select("*").eq("id", toUser).single();
        if (recipientProfile) {
          await checkAndAwardBadges(toUser, recipientProfile);
        }
      }

      setDone(true);
      const confetti = (await import("canvas-confetti")).default;
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
      trackAnalyticsEvent('props_sent', user.id).catch(() => {});
      hapticLight();
      toast.success(CONFIRMATIONS.propsSent);
      setTimeout(onDone, 1500);
    } catch (err) {
      console.error("[GiveProps]", err);
      toast.error(ERROR_STATES.generic);
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <Card className="border-primary/20">
        <CardContent className="p-6 text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-4xl mb-2">🎉</motion.div>
          <p className="font-serif text-lg text-foreground">Props sent!</p>
        </CardContent>
      </Card>
    );
  }

  if (attendees.length === 0) return null;

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-base text-foreground">Give Props to people you met</h3>
          <span className="text-xs text-muted-foreground font-medium">{remaining}/{MAX_PROPS} remaining</span>
        </div>

        {/* Attendee Grid */}
        <div className="grid grid-cols-4 gap-3">
          {attendees.map(a => {
            const pCount = personProps(a.id).length;
            return (
              <button
                key={a.id}
                onClick={() => setSelectedPerson(selectedPerson === a.id ? null : a.id)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                  selectedPerson === a.id ? "bg-primary/10 ring-2 ring-primary/30" : "hover:bg-muted"
                }`}
              >
                <div className="relative">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={a.avatar_url || ""} />
                    <AvatarFallback className="text-xs bg-muted">{getInitials(a.display_name)}</AvatarFallback>
                  </Avatar>
                  {pCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground rounded-full text-[10px] flex items-center justify-center font-bold">
                      {pCount}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground truncate w-full text-center">
                  {a.display_name?.split(" ")[0] || "Member"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Prop Type Buttons */}
        <AnimatePresence>
          {selectedPerson && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-3 gap-2 pt-2">
                {PROP_TYPES.map(pt => {
                  const selected = pendingProps.some(p => p.toUser === selectedPerson && p.propType === pt.type);
                  return (
                    <button
                      key={pt.type}
                      onClick={() => toggleProp(selectedPerson, pt.type)}
                      disabled={!selected && remaining <= 0}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
                        selected
                          ? "bg-primary/10 border-primary/40 ring-1 ring-primary/20"
                          : "border-border hover:bg-muted disabled:opacity-30"
                      }`}
                    >
                      <span className="text-xl">{pt.emoji}</span>
                      <span className="text-[11px] text-foreground font-medium">{pt.label}</span>
                      {selected && <span className="text-primary text-xs">✓</span>}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Anonymous toggle */}
        <div className="flex items-center gap-3">
          <Switch checked={!anonymous} onCheckedChange={v => setAnonymous(!v)} />
          <span className="text-xs text-muted-foreground">Let them know it was me</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onDone}>Skip</Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={saving || pendingProps.length === 0}>
            {saving ? "Sending..." : `Send ${pendingProps.length} prop${pendingProps.length !== 1 ? "s" : ""}`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Props display for profiles
export function PropsReceived({ userId, isOwnProfile }: { userId: string; isOwnProfile?: boolean }) {
  const [propCounts, setPropCounts] = useState<Record<string, number>>({});
  const [givenCount, setGivenCount] = useState(0);
  const [givenEvents, setGivenEvents] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: received } = await supabase
        .from("peer_props")
        .select("prop_type")
        .eq("to_user", userId);
      if (received) {
        const counts: Record<string, number> = {};
        received.forEach(r => { counts[r.prop_type] = (counts[r.prop_type] || 0) + 1; });
        setPropCounts(counts);
      }
      if (isOwnProfile) {
        const { data: given } = await supabase
          .from("peer_props")
          .select("id, event_id")
          .eq("from_user", userId);
        if (given) {
          setGivenCount(given.length);
          setGivenEvents(new Set(given.map(g => g.event_id)).size);
        }
      }
    })();
  }, [userId, isOwnProfile]);

  const total = Object.values(propCounts).reduce((a, b) => a + b, 0);
  if (total === 0 && !isOwnProfile) return null;

  return (
    <Card>
      <CardContent className="pt-4">
        <h3 className="font-serif text-base text-foreground mb-3">Props Received</h3>
        <div className="flex flex-wrap gap-3">
          {PROP_TYPES.map(pt => {
            const count = propCounts[pt.type] || 0;
            if (count === 0) return null;
            return (
              <span key={pt.type} className="text-sm font-medium text-foreground">
                {pt.emoji} {count}
              </span>
            );
          })}
          {total === 0 && <p className="text-xs text-muted-foreground">No props yet — attend a session!</p>}
        </div>
        {isOwnProfile && givenCount > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            Props Given: {givenCount} total across {givenEvents} session{givenEvents !== 1 ? "s" : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Get top 2 prop types for discover cards
export function useTopProps(userId: string) {
  const [topProps, setTopProps] = useState<{ emoji: string; label: string }[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("peer_props")
        .select("prop_type")
        .eq("to_user", userId);
      if (!data || data.length === 0) return;
      const counts: Record<string, number> = {};
      data.forEach(r => { counts[r.prop_type] = (counts[r.prop_type] || 0) + 1; });
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 2);
      setTopProps(sorted.map(([type]) => {
        const def = PROP_TYPES.find(p => p.type === type)!;
        return { emoji: def.emoji, label: def.label.split(" ").pop()! };
      }));
    })();
  }, [userId]);

  return topProps;
}
