import { useState } from "react";
import { Bell, Check, Sparkles, Hand, CheckCircle2, Heart, Coffee, Link2, UserPlus } from "lucide-react";
import { CreditsBadge } from "@/components/growth/CreditsBadge";
import { useFocusCredits } from "@/hooks/useFocusCredits";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { ConnectionRequestsList, useConnectionRequests } from "@/components/connections/ConnectionRequestsList";
import { Link, useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { TierBadge } from "@/components/ui/TierBadge";
import { useSubscription } from "@/hooks/useSubscription";
import type { TierId } from "@/hooks/useSubscription";

const typeIcons: Record<string, { icon: React.ElementType; emoji?: string }> = {
  match_found: { icon: Sparkles },
  request_claimed: { icon: Hand },
  request_completed: { icon: CheckCircle2 },
  props_received: { icon: Heart },
  coffee_match: { icon: Coffee },
  connection_formed: { icon: Link2 },
  system: { icon: Bell },
  badge_earned: { icon: Sparkles, emoji: "🏅" },
  fire_received: { icon: Heart, emoji: "🔥" },
  new_prompt: { icon: Bell, emoji: "💬" },
  new_event: { icon: Bell, emoji: "📅" },
  waitlist_promoted: { icon: Sparkles, emoji: "🎉" },
  reliability: { icon: Bell, emoji: "⚠️" },
  suspension: { icon: Bell, emoji: "🚫" },
  admin_alert: { icon: Bell, emoji: "🚨" },
};

function NotifIcon({ type }: { type: string | null }) {
  const config = typeIcons[type || ""] || typeIcons.system;
  if (config.emoji) {
    return <span className="text-lg shrink-0">{config.emoji}</span>;
  }
  const Icon = config.icon;
  return <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />;
}

export function TopBar() {
  const { profile, user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllRead } = useNotifications();
  const { pendingCount } = useConnectionRequests();
  const { tier } = useSubscription();
  const { balance: fcBalance } = useFocusCredits();
  const totalBadge = unreadCount + pendingCount;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const initials = profile?.display_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || user?.email?.[0].toUpperCase() || "U";

  const handleNotificationClick = (n: { id: string; link: string | null; read: boolean | null }) => {
    if (!n.read) markAsRead(n.id);
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
        <Link to="/home" className="flex items-baseline gap-0.5">
          <span className="font-serif text-xl">Dana</span>
          <span className="font-sans font-bold text-xl">Done</span>
        </Link>

        <div className="flex items-center gap-3">
          <CreditsBadge balance={fcBalance} compact />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors">
                <Bell className="w-5 h-5" />
                {totalBadge > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                    {totalBadge > 9 ? "•" : totalBadge}
                  </span>
                )}
              </button>
            </SheetTrigger>
            <SheetContent className="w-[340px] sm:w-[380px] p-0">
              <SheetHeader className="px-4 pt-4 pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <SheetTitle className="font-serif text-lg">Notifications</SheetTitle>
                  {unreadCount > 0 && (
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllRead}>
                      <Check className="w-3 h-3 mr-1" /> Mark all read
                    </Button>
                  )}
                </div>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-5rem)]">
                <ConnectionRequestsList onAccepted={() => {}} />
                {notifications.length === 0 && pendingCount === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                    <p className="text-2xl mb-2">🎉</p>
                    <p className="text-sm text-muted-foreground">You're all caught up!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        className={cn(
                          "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex gap-3",
                          !n.read && "bg-primary/5"
                        )}
                        onClick={() => handleNotificationClick(n)}
                      >
                        <div className="mt-0.5">
                          <NotifIcon type={n.type} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm", !n.read ? "font-medium text-foreground" : "text-muted-foreground")}>
                            {n.title}
                          </p>
                          {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                          {n.created_at && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true })}
                            </p>
                          )}
                        </div>
                        {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />}
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </SheetContent>
          </Sheet>

          <Link to="/me" className="flex items-center gap-1.5">
            <TierBadge tier={tier as TierId} size="sm" />
            <Avatar className="w-8 h-8">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>
    </header>
  );
}
