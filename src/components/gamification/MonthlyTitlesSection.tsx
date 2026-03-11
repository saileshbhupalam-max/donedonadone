import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { MONTHLY_TITLE_DEFS } from "@/lib/ranks";
import { format } from "date-fns";

interface MonthlyTitle {
  title_type: string;
  month: string;
  value: number;
}

interface Props {
  userId: string;
  compact?: boolean; // For profile view, just show most recent
}

export function MonthlyTitlesSection({ userId, compact = false }: Props) {
  const [titles, setTitles] = useState<MonthlyTitle[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("monthly_titles")
        .select("title_type, month, value")
        .eq("user_id", userId)
        .order("month", { ascending: false });
      setTitles((data || []).map(t => ({ ...t, value: Number(t.value ?? 0) })));
      setLoaded(true);
    })();
  }, [userId]);

  if (!loaded || titles.length === 0) return null;

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  if (compact) {
    // Show most recent title as banner
    const recent = titles[0];
    const def = MONTHLY_TITLE_DEFS[recent.title_type];
    if (!def) return null;
    const monthLabel = formatMonth(recent.month);
    const isCurrent = recent.month === currentMonth;

    return (
      <div className={`rounded-full px-3 py-1 text-xs font-medium ${
        isCurrent ? "bg-[#D4A853]/15 text-[#D4A853] border border-[#D4A853]/30" : "bg-muted text-muted-foreground"
      }`}>
        {monthLabel}'s {def.emoji} {def.name}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <h3 className="font-serif text-base text-foreground mb-3">Your Titles</h3>
        <div className="space-y-2">
          {titles.map(t => {
            const def = MONTHLY_TITLE_DEFS[t.title_type];
            if (!def) return null;
            const isCurrent = t.month === currentMonth;
            return (
              <div
                key={`${t.title_type}-${t.month}`}
                className={`rounded-xl border p-3 ${
                  isCurrent ? "border-[#D4A853]/30 bg-[#D4A853]/5" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {def.emoji} {def.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{formatMonth(t.month)}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{def.description}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/** Current month title banner for ProfileView */
export function CurrentMonthTitleBanner({ userId, displayName }: { userId: string; displayName: string }) {
  const [title, setTitle] = useState<MonthlyTitle | null>(null);

  useEffect(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    supabase
      .from("monthly_titles")
      .select("title_type, month, value")
      .eq("user_id", userId)
      .eq("month", currentMonth)
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) setTitle({ ...data[0], value: Number(data[0].value ?? 0) });
      });
  }, [userId]);

  if (!title) return null;
  const def = MONTHLY_TITLE_DEFS[title.title_type];
  if (!def) return null;

  return (
    <div className="rounded-xl bg-[#D4A853]/10 border border-[#D4A853]/20 px-3 py-2 text-center">
      <p className="text-xs font-medium text-foreground">
        {displayName} is {formatMonth(title.month)}'s {def.emoji} {def.name}
      </p>
    </div>
  );
}

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return format(date, "MMMM yyyy");
}
