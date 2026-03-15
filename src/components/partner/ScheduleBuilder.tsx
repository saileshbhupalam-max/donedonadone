/**
 * @module ScheduleBuilder
 * @description Weekly schedule editor for venue partners. Set available time slots,
 * seats, and pricing per day of week. Also manage blackout dates.
 *
 * Dependencies: supabase, sonner
 * Tables: venue_slots, venue_slot_blackouts
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, Plus, Trash2, Clock, Users, IndianRupee, CalendarOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DEFAULT_WINDOWS = [
  { label: "Morning Focus", start: "09:30", end: "13:30" },
  { label: "Afternoon Hustle", start: "14:00", end: "18:00" },
  { label: "Evening", start: "18:00", end: "21:00" },
];

interface VenueSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_cowork_seats: number;
  price_member_paise: number;
  price_outsider_paise: number;
  platform_fee_paise: number;
  auto_approve: boolean;
  is_active: boolean;
}

interface Blackout {
  id: string;
  slot_id: string;
  blackout_date: string;
  reason: string | null;
}

interface ScheduleBuilderProps {
  locationId: string;
}

export function ScheduleBuilder({ locationId }: ScheduleBuilderProps) {
  const [slots, setSlots] = useState<VenueSlot[]>([]);
  const [blackouts, setBlackouts] = useState<Blackout[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number>(1); // Monday
  const [newBlackoutDate, setNewBlackoutDate] = useState("");
  const [newBlackoutReason, setNewBlackoutReason] = useState("");

  const load = useCallback(async () => {
    const [slotsRes, blackoutsRes] = await Promise.all([
      supabase.from("venue_slots").select("*").eq("location_id", locationId).order("day_of_week").order("start_time"),
      supabase.from("venue_slot_blackouts").select("*").in("slot_id",
        (await supabase.from("venue_slots").select("id").eq("location_id", locationId)).data?.map((s: any) => s.id) || []
      ).order("blackout_date"),
    ]);
    setSlots((slotsRes.data || []) as VenueSlot[]);
    setBlackouts((blackoutsRes.data || []) as Blackout[]);
    setLoading(false);
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  const daySlotsMap = new Map<number, VenueSlot[]>();
  for (const s of slots) {
    const arr = daySlotsMap.get(s.day_of_week) || [];
    arr.push(s);
    daySlotsMap.set(s.day_of_week, arr);
  }

  const addSlot = async (dayOfWeek: number, window: typeof DEFAULT_WINDOWS[0]) => {
    setSaving(true);
    const { data, error } = await supabase.from("venue_slots").insert({
      location_id: locationId,
      day_of_week: dayOfWeek,
      start_time: window.start,
      end_time: window.end,
      max_cowork_seats: 5,
      price_member_paise: 0,
      price_outsider_paise: 0,
      platform_fee_paise: 0,
      auto_approve: true,
      is_active: true,
    }).select("*").single();
    if (error) {
      if (error.code === "23505") toast.error("This time slot already exists for this day.");
      else toast.error("Could not add slot.");
    } else if (data) {
      setSlots((prev) => [...prev, data as VenueSlot]);
      toast.success(`Added ${window.label} on ${DAY_NAMES_FULL[dayOfWeek]}`);
    }
    setSaving(false);
  };

  const updateSlot = async (slotId: string, updates: Partial<VenueSlot>) => {
    const { error } = await supabase.from("venue_slots").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", slotId);
    if (error) { toast.error("Could not update slot."); return; }
    setSlots((prev) => prev.map((s) => s.id === slotId ? { ...s, ...updates } : s));
  };

  const deleteSlot = async (slotId: string) => {
    const { error } = await supabase.from("venue_slots").delete().eq("id", slotId);
    if (error) { toast.error("Could not delete slot."); return; }
    setSlots((prev) => prev.filter((s) => s.id !== slotId));
    setBlackouts((prev) => prev.filter((b) => b.slot_id !== slotId));
    toast.success("Slot removed.");
  };

  const addBlackout = async () => {
    if (!newBlackoutDate) return;
    const daySlots = daySlotsMap.get(selectedDay) || [];
    if (daySlots.length === 0) { toast.error("No slots on this day to blackout."); return; }
    setSaving(true);
    let added = 0;
    for (const slot of daySlots) {
      const { data, error } = await supabase.from("venue_slot_blackouts").insert({
        slot_id: slot.id, blackout_date: newBlackoutDate, reason: newBlackoutReason || null,
      }).select("*").maybeSingle();
      if (!error && data) { setBlackouts((prev) => [...prev, data as Blackout]); added++; }
    }
    if (added > 0) toast.success(`Blackout added for ${newBlackoutDate}`);
    setNewBlackoutDate("");
    setNewBlackoutReason("");
    setSaving(false);
  };

  const removeBlackout = async (blackoutId: string) => {
    await supabase.from("venue_slot_blackouts").delete().eq("id", blackoutId);
    setBlackouts((prev) => prev.filter((b) => b.id !== blackoutId));
  };

  if (loading) return null;

  const daySlots = daySlotsMap.get(selectedDay) || [];
  const futureBlackouts = blackouts.filter((b) => b.blackout_date >= new Date().toISOString().split("T")[0]);

  return (
    <div className="space-y-4">
      {/* Schedule */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <h2 className="font-serif text-lg text-foreground">Weekly Schedule</h2>
          </div>
          <p className="text-[10px] text-muted-foreground">Set when DanaDone members can book coworking sessions at your venue.</p>

          {/* Day selector */}
          <div className="flex gap-1">
            {DAY_NAMES.map((name, i) => {
              const hasSlots = (daySlotsMap.get(i) || []).length > 0;
              return (
                <button key={i} onClick={() => setSelectedDay(i)}
                  className={cn("flex-1 py-1.5 rounded-md text-xs font-medium transition-all",
                    selectedDay === i ? "bg-primary text-primary-foreground" : hasSlots ? "bg-primary/10 text-primary hover:bg-primary/20" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}>
                  {name}
                  {hasSlots && selectedDay !== i && <span className="block text-[8px]">{(daySlotsMap.get(i) || []).length}</span>}
                </button>
              );
            })}
          </div>

          {/* Slots for selected day */}
          <div className="space-y-3">
            {daySlots.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3 text-center">No slots on {DAY_NAMES_FULL[selectedDay]}. Add one below.</p>
            ) : (
              daySlots.map((slot) => (
                <div key={slot.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">{slot.start_time} – {slot.end_time}</span>
                      {!slot.is_active && <Badge variant="outline" className="text-[9px]">Paused</Badge>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch checked={slot.is_active} onCheckedChange={(v) => updateSlot(slot.id, { is_active: v })} />
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteSlot(slot.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> Seats</Label>
                      <Input type="number" min={1} max={50} value={slot.max_cowork_seats}
                        onChange={(e) => updateSlot(slot.id, { max_cowork_seats: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="h-8 text-sm mt-0.5" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><IndianRupee className="w-3 h-3" /> Member price</Label>
                      <Input type="number" min={0} value={slot.price_member_paise / 100}
                        onChange={(e) => updateSlot(slot.id, { price_member_paise: Math.max(0, parseFloat(e.target.value) || 0) * 100 })}
                        className="h-8 text-sm mt-0.5" placeholder="0" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><IndianRupee className="w-3 h-3" /> Outsider price</Label>
                      <Input type="number" min={0} value={slot.price_outsider_paise / 100}
                        onChange={(e) => updateSlot(slot.id, { price_outsider_paise: Math.max(0, parseFloat(e.target.value) || 0) * 100 })}
                        className="h-8 text-sm mt-0.5" placeholder="0" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Quick-add buttons */}
          <Separator />
          <p className="text-xs text-muted-foreground">Add a time slot for {DAY_NAMES_FULL[selectedDay]}:</p>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_WINDOWS.map((w) => {
              const exists = daySlots.some((s) => s.start_time === w.start);
              return (
                <Button key={w.label} variant="outline" size="sm" className="text-xs gap-1"
                  disabled={exists || saving} onClick={() => addSlot(selectedDay, w)}>
                  <Plus className="w-3 h-3" /> {w.label} ({w.start}–{w.end})
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Blackouts */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center gap-2">
            <CalendarOff className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-serif text-base text-foreground">Blackout Dates</h2>
          </div>
          <p className="text-[10px] text-muted-foreground">Mark dates when your venue is unavailable (holidays, private events, etc.)</p>

          <div className="flex gap-2">
            <Input type="date" value={newBlackoutDate} onChange={(e) => setNewBlackoutDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]} className="flex-1 h-8 text-sm" />
            <Input value={newBlackoutReason} onChange={(e) => setNewBlackoutReason(e.target.value)}
              placeholder="Reason (optional)" className="flex-1 h-8 text-sm" />
            <Button size="sm" className="h-8" onClick={addBlackout} disabled={!newBlackoutDate || saving}>Add</Button>
          </div>

          {futureBlackouts.length > 0 && (
            <div className="space-y-1">
              {futureBlackouts.map((b) => (
                <div key={b.id} className="flex items-center justify-between text-sm py-1">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground">{format(parseISO(b.blackout_date + "T00:00:00"), "EEE, MMM d")}</span>
                    {b.reason && <span className="text-xs text-muted-foreground">— {b.reason}</span>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeBlackout(b.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
