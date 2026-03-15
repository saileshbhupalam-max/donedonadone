import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap, Users, Calendar, MapPin, Clock, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { displayNeighborhood } from "@/lib/neighborhoods";

interface DemandCluster {
  neighborhood: string;
  preferred_time: string;
  count: number;
  user_ids: string[];
}

interface AutoSession {
  id: string;
  title: string;
  date: string;
  start_time: string;
  neighborhood: string;
  demand_cluster_key: string;
  max_spots: number;
  created_at: string;
}

export function DemandClustersTab() {
  const [loading, setLoading] = useState(true);
  const [clusters, setClusters] = useState<DemandCluster[]>([]);
  const [autoSessions, setAutoSessions] = useState<AutoSession[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [triggering, setTriggering] = useState(false);

  const fetchData = async () => {
    setLoading(true);

    // Fetch pending session requests
    const { data: requests } = await supabase
      .from("session_requests")
      .select("id, user_id, neighborhood, preferred_time")
      .eq("status", "pending");

    if (requests) {
      setPendingCount(requests.length);

      // Group into clusters
      const groups: Record<string, DemandCluster> = {};
      for (const r of requests) {
        const key = `${r.neighborhood}__${r.preferred_time}`;
        if (!groups[key]) {
          groups[key] = {
            neighborhood: r.neighborhood,
            preferred_time: r.preferred_time,
            count: 0,
            user_ids: [],
          };
        }
        groups[key].count++;
        groups[key].user_ids.push(r.user_id);
      }
      setClusters(
        Object.values(groups).sort((a, b) => b.count - a.count)
      );
    }

    // Fetch auto-created sessions
    const { data: sessions } = await supabase
      .from("events")
      .select("id, title, date, start_time, neighborhood, demand_cluster_key, max_spots, created_at")
      .eq("auto_created", true)
      .order("created_at", { ascending: false })
      .limit(20);

    if (sessions) {
      setAutoSessions(sessions as AutoSession[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-sessions");
      if (error) throw error;
      toast.success(`Auto-session sweep: ${data?.created || 0} sessions created`);
      await fetchData();
    } catch (err) {
      toast.error("Failed to trigger auto-sessions");
      console.error("[DemandClusters]", err);
    }
    setTriggering(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const readyClusters = clusters.filter((c) => c.count >= 3);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{readyClusters.length}</p>
            <p className="text-xs text-muted-foreground">Ready Clusters</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{autoSessions.length}</p>
            <p className="text-xs text-muted-foreground">Auto-Sessions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Pending Requests</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleTrigger}
          disabled={triggering || readyClusters.length === 0}
        >
          {triggering ? (
            <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
          ) : (
            <Zap className="w-4 h-4 mr-1.5" />
          )}
          {triggering ? "Running..." : "Trigger Auto-Session Sweep"}
        </Button>
        <Button size="sm" variant="outline" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Demand Clusters */}
      <div>
        <h3 className="text-sm font-medium text-foreground mb-3">Demand Clusters</h3>
        {clusters.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No pending session requests
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {clusters.map((cluster) => (
              <Card
                key={`${cluster.neighborhood}__${cluster.preferred_time}`}
                className={cluster.count >= 3 ? "border-green-500/30" : ""}
              >
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium">
                        {displayNeighborhood(cluster.neighborhood)}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span className="capitalize">{cluster.preferred_time}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={cluster.count >= 3 ? "default" : "secondary"}
                      className="text-xs"
                    >
                      <Users className="w-3 h-3 mr-1" />
                      {cluster.count}/3
                    </Badge>
                    {cluster.count >= 3 && (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-500/30">
                        Ready
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Auto-Created Sessions */}
      <div>
        <h3 className="text-sm font-medium text-foreground mb-3">
          Auto-Created Sessions ({autoSessions.length})
        </h3>
        {autoSessions.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No auto-created sessions yet
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {autoSessions.map((session) => (
              <Card key={session.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{session.title}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {session.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {session.start_time}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {displayNeighborhood(session.neighborhood || "")}
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    <Users className="w-3 h-3 mr-1" />
                    max {session.max_spots}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
