import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { UserPlus } from "lucide-react";

interface ConnectionRequest {
  id: string;
  from_user: string;
  message: string | null;
  created_at: string;
  profile: { display_name: string | null; avatar_url: string | null } | null;
}

export function useConnectionRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("connection_requests")
      .select("id, from_user, message, created_at")
      .eq("to_user", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (!data || data.length === 0) {
      setRequests([]);
      setLoading(false);
      return;
    }

    // Fetch profiles for senders
    const senderIds = data.map((r: any) => r.from_user);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", senderIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    setRequests(
      data.map((r: any) => ({
        ...r,
        profile: profileMap.get(r.from_user) || null,
      }))
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`conn_requests:${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "connection_requests",
        filter: `to_user=eq.${user.id}`,
      }, () => fetchRequests())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchRequests]);

  return { requests, loading, refetch: fetchRequests, pendingCount: requests.length };
}

export function ConnectionRequestsList({ onAccepted }: { onAccepted?: () => void }) {
  const { requests, refetch } = useConnectionRequests();
  const [acting, setActing] = useState<string | null>(null);

  const handleAccept = async (id: string) => {
    setActing(id);
    const { error } = await supabase.rpc("accept_connection_request", { p_request_id: id });
    if (error) {
      toast.error("Couldn't accept request");
      console.error(error);
    } else {
      toast.success("Connection accepted!");
      onAccepted?.();
    }
    setActing(null);
    refetch();
  };

  const handleDecline = async (id: string) => {
    setActing(id);
    await supabase
      .from("connection_requests")
      .update({ status: "declined", responded_at: new Date().toISOString() })
      .eq("id", id);
    toast("Request declined");
    setActing(null);
    refetch();
  };

  if (requests.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 px-4 py-2">
        <UserPlus className="w-3.5 h-3.5" /> Connection Requests
      </p>
      {requests.map((r) => (
        <div key={r.id} className="px-4 py-3 flex gap-3 items-start bg-primary/5">
          <Avatar className="w-9 h-9 shrink-0">
            <AvatarImage src={r.profile?.avatar_url || ""} />
            <AvatarFallback className="text-xs">{getInitials(r.profile?.display_name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{r.profile?.display_name || "Someone"}</p>
            {r.message && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 italic">"{r.message}"</p>}
            <p className="text-[10px] text-muted-foreground mt-1">
              {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
            </p>
            <div className="flex gap-2 mt-2">
              <Button size="sm" className="h-7 text-xs" onClick={() => handleAccept(r.id)} disabled={acting === r.id}>
                Accept
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleDecline(r.id)} disabled={acting === r.id}>
                Decline
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
