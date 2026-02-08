import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CalendarDays, Clock, MapPin, Users } from "lucide-react"

const vibeColors: Record<string, string> = {
  deep_focus: "bg-teal-100 text-teal-800",
  casual_social: "bg-amber-100 text-amber-800",
  balanced: "bg-stone-100 text-stone-800",
}

const vibeLabels: Record<string, string> = {
  deep_focus: "Deep Focus",
  casual_social: "Casual Social",
  balanced: "Balanced",
}

export default async function SessionsPage() {
  const supabase = await createClient()

  const { data: sessions } = await supabase
    .from("sessions")
    .select("*, venues(*)")
    .eq("status", "upcoming")
    .gte("session_date", new Date().toISOString().split("T")[0])
    .order("session_date", { ascending: true })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Browse Sessions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Find and book coworking sessions at venues near you
        </p>
      </div>

      {sessions && sessions.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <Card
              key={session.id}
              className="border-border transition-shadow hover:shadow-md"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base text-foreground">
                    {session.title}
                  </CardTitle>
                  <Badge
                    className={vibeColors[session.vibe] || vibeColors.balanced}
                    variant="secondary"
                  >
                    {vibeLabels[session.vibe] || session.vibe}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {session.description}
                </p>
                <div className="mt-2 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{session.venues?.name || "Venue TBA"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span>
                      {new Date(session.session_date).toLocaleDateString(
                        "en-IN",
                        {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        }
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {session.start_time?.slice(0, 5)} -{" "}
                      {session.end_time?.slice(0, 5)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span>
                      {session.current_participants}/{session.max_participants}{" "}
                      spots
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-lg font-bold text-foreground">
                    {"₹"}{Number(session.price).toFixed(0)}
                  </span>
                  <Button size="sm">Book now</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center py-10 text-center">
            <CalendarDays className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No sessions available right now. Check back soon!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
