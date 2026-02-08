"use client"

import { useState } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loader2, UsersRound, Wand2 } from "lucide-react"
import { TraitBadge } from "@/components/admin/trait-badge"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function AdminGroupsPage() {
  const [sessionId, setSessionId] = useState("")
  const [assigning, setAssigning] = useState(false)

  const { data, isLoading, mutate } = useSWR(
    sessionId ? `/api/admin/groups?session_id=${sessionId}` : null,
    fetcher
  )

  const groups = data?.groups || []

  const handleAutoAssign = async () => {
    if (!sessionId) return
    setAssigning(true)
    await fetch("/api/admin/groups/auto-assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    })
    mutate()
    setAssigning(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Groups</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          View and auto-assign coworker groups for sessions
        </p>
      </div>

      {/* Session selector */}
      <Card className="border-border">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="session-id">Session ID</Label>
            <Input
              id="session-id"
              placeholder="Paste a session UUID..."
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
            />
          </div>
          <Button onClick={handleAutoAssign} disabled={!sessionId || assigning}>
            {assigning ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="mr-2 h-4 w-4" />
            )}
            Auto-Assign Groups
          </Button>
        </CardContent>
      </Card>

      {/* Groups */}
      {!sessionId ? (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <UsersRound className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Enter a session ID to view groups</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : groups.length === 0 ? (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <UsersRound className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No groups formed yet. Click Auto-Assign to create groups.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group: Record<string, unknown>) => (
            <Card key={group.id as string} className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Group {group.group_number as number}</CardTitle>
                  {group.table_assignment ? (
                    <Badge variant="outline" className="text-xs">
                      {String(group.table_assignment)}
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {((group.group_members || []) as Record<string, unknown>[]).map((member) => {
                  const profile = member.profiles as Record<string, unknown> | null
                  const prefs = member.coworker_preferences as Record<string, unknown> | null
                  return (
                    <div key={member.user_id as string} className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3">
                      <p className="text-sm font-medium text-foreground">
                        {profile?.display_name as string || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">{profile?.work_type as string || ""}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <TraitBadge type="vibe" value={prefs?.work_vibe as string || null} />
                        <TraitBadge type="noise" value={prefs?.noise_preference as string || null} />
                        <TraitBadge type="comm" value={prefs?.communication_style as string || null} />
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
