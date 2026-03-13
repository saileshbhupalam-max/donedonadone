import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraduationCap, Star, Users, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { getInitials } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  getMentorMatches,
  fetchMentees,
  calculateMentorCompatibility,
  isMentor,
  isMentee,
  type MentorMatch,
} from "@/lib/mentorMatch";
import { MentorRequestDialog } from "./MentorRequestDialog";
import { useConnections } from "@/hooks/useConnections";
import type { Tables } from "@/integrations/supabase/types";

type TasteGraph = Tables<"taste_graph">;

interface MenteeDisplay {
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
  tagline: string | null;
  seekingHelp: string[];
  matchScore: number;
  matchReasons: string[];
}

function MentorCard({
  mentor,
  onRequestMentoring,
}: {
  mentor: MentorMatch;
  onRequestMentoring: (mentor: MentorMatch) => void;
}) {
  const navigate = useNavigate();

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <Avatar
            className="w-10 h-10 cursor-pointer shrink-0"
            onClick={() => navigate(`/profile/${mentor.profileId}`)}
          >
            <AvatarImage src={mentor.avatarUrl || ""} />
            <AvatarFallback className="text-xs">
              {getInitials(mentor.displayName)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p
                className="text-sm font-medium text-foreground truncate cursor-pointer hover:underline"
                onClick={() => navigate(`/profile/${mentor.profileId}`)}
              >
                {mentor.displayName}
              </p>
              {mentor.mentorScore >= 40 && (
                <Badge
                  variant="outline"
                  className={`text-[9px] px-1.5 py-0 shrink-0 ${
                    mentor.mentorScore >= 70
                      ? "border-primary/30 text-primary"
                      : "border-border"
                  }`}
                >
                  <Star className="w-2.5 h-2.5 mr-0.5" />
                  {mentor.mentorScore}%
                </Badge>
              )}
            </div>

            {mentor.tagline && (
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {mentor.tagline}
              </p>
            )}

            {mentor.canHelpWith.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {mentor.canHelpWith.slice(0, 3).map((item) => (
                  <Badge
                    key={item}
                    variant="secondary"
                    className="text-[9px] px-1.5 py-0"
                  >
                    {item}
                  </Badge>
                ))}
              </div>
            )}

            {mentor.domains.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {mentor.domains.slice(0, 2).map((domain) => (
                  <Badge
                    key={domain}
                    variant="outline"
                    className="text-[8px] px-1 py-0 border-primary/20 text-primary/70"
                  >
                    {domain}
                  </Badge>
                ))}
              </div>
            )}

            {mentor.matchReasons.length > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1 italic">
                {mentor.matchReasons[0]}
              </p>
            )}
          </div>

          <Button
            size="sm"
            variant="outline"
            className="text-[10px] h-7 shrink-0"
            onClick={() => onRequestMentoring(mentor)}
          >
            <GraduationCap className="w-3 h-3 mr-1" />
            Mentor
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MenteeCard({ mentee }: { mentee: MenteeDisplay }) {
  const navigate = useNavigate();

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <Avatar
            className="w-10 h-10 cursor-pointer shrink-0"
            onClick={() => navigate(`/profile/${mentee.profileId}`)}
          >
            <AvatarImage src={mentee.avatarUrl || ""} />
            <AvatarFallback className="text-xs">
              {getInitials(mentee.displayName)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-medium text-foreground truncate cursor-pointer hover:underline"
              onClick={() => navigate(`/profile/${mentee.profileId}`)}
            >
              {mentee.displayName}
            </p>
            {mentee.tagline && (
              <p className="text-[11px] text-muted-foreground truncate">
                {mentee.tagline}
              </p>
            )}
            {mentee.seekingHelp.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {mentee.seekingHelp.slice(0, 3).map((item) => (
                  <Badge
                    key={item}
                    variant="outline"
                    className="text-[9px] px-1.5 py-0"
                  >
                    Seeking: {item}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {mentee.matchScore >= 40 && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 shrink-0"
            >
              {mentee.matchScore}%
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ActiveMentoringSection() {
  const { connections, loading } = useConnections();
  const navigate = useNavigate();

  // Filter connections that are mentorship type
  const mentoringConnections = connections.filter(
    (c) => c.connection_type === "mentorship"
  );

  if (loading) return <Skeleton className="h-16" />;
  if (mentoringConnections.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground">
        Your Mentoring Connections
      </h3>
      {mentoringConnections.map((c) => (
        <Card key={c.id} className="overflow-hidden">
          <div
            className="flex items-center gap-3 p-3 cursor-pointer"
            onClick={() => navigate(`/profile/${c.user_id}`)}
          >
            <Avatar className="w-9 h-9">
              <AvatarImage src={c.avatar_url || ""} />
              <AvatarFallback className="text-xs">
                {getInitials(c.display_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {c.display_name || "Member"}
              </p>
            </div>
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0"
            >
              <GraduationCap className="w-3 h-3 mr-0.5" />
              Mentor
            </Badge>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function MentorSection() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [mentors, setMentors] = useState<MentorMatch[]>([]);
  const [mentees, setMentees] = useState<MenteeDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [requestTarget, setRequestTarget] = useState<MentorMatch | null>(null);

  const userIsMentor = profile ? isMentor(profile) : false;
  const userIsMentee = profile ? isMentee(profile) : false;

  useEffect(() => {
    if (!user || !profile) return;

    const load = async () => {
      // Get current user's taste graph
      const { data: myTasteGraph } = await supabase
        .from("taste_graph")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      // Fetch mentor matches
      const mentorMatches = await getMentorMatches(
        profile,
        myTasteGraph,
        showAll ? 50 : 5
      );
      setMentors(mentorMatches);

      // If user is a mentor, also fetch mentees
      if (userIsMentor) {
        const menteeData = await fetchMentees(user.id);
        const menteeDisplays: MenteeDisplay[] = menteeData.map(
          ({ profile: menteeProfile, tasteGraph }) => {
            const { score, reasons } = calculateMentorCompatibility(
              menteeProfile,
              profile,
              tasteGraph,
              myTasteGraph
            );
            const seekingHelp = (menteeProfile.looking_for ?? []).filter(
              (l) =>
                !["mentorship", "mentor", "career guidance"].includes(
                  l.toLowerCase()
                )
            );
            return {
              profileId: menteeProfile.id,
              displayName: menteeProfile.display_name || "Member",
              avatarUrl: menteeProfile.avatar_url,
              tagline: menteeProfile.tagline,
              seekingHelp: seekingHelp.slice(0, 4),
              matchScore: score,
              matchReasons: reasons,
            };
          }
        );
        setMentees(
          menteeDisplays
            .sort((a, b) => b.matchScore - a.matchScore)
            .slice(0, 10)
        );
      }

      setLoading(false);
    };
    load();
  }, [user, profile, userIsMentor, showAll]);

  if (loading) return <Skeleton className="h-32 mx-4 mt-5" />;

  // If no mentors and no mentees, show a CTA
  if (mentors.length === 0 && mentees.length === 0 && !userIsMentor && !userIsMentee) {
    return (
      <section className="mt-5">
        <h2 className="font-serif text-lg px-4 mb-2 text-foreground flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-primary" /> Mentoring
        </h2>
        <Card className="mx-4">
          <CardContent className="py-6 text-center space-y-2">
            <GraduationCap className="w-6 h-6 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">
              No mentors or mentees found yet.
            </p>
            <p className="text-xs text-muted-foreground">
              Add "mentorship" to your Looking For or Can Offer to join the mentoring network.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/me")}
            >
              Update Profile
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  const displayedMentors = showAll ? mentors : mentors.slice(0, 5);

  return (
    <section className="mt-5">
      <h2 className="font-serif text-lg px-4 mb-2 text-foreground flex items-center gap-2">
        <GraduationCap className="w-4 h-4 text-primary" /> Mentoring
      </h2>

      {/* Show active mentoring connections */}
      {(userIsMentor || userIsMentee) && (
        <div className="px-4 mb-3">
          <ActiveMentoringSection />
        </div>
      )}

      <div className="px-4">
        <Tabs defaultValue="mentors">
          <TabsList className="w-full">
            <TabsTrigger value="mentors" className="flex-1 text-xs">
              <GraduationCap className="w-3.5 h-3.5 mr-1" />
              Available Mentors
              {mentors.length > 0 && (
                <span className="ml-1 text-muted-foreground">
                  ({mentors.length})
                </span>
              )}
            </TabsTrigger>
            {userIsMentor && (
              <TabsTrigger value="mentees" className="flex-1 text-xs">
                <Users className="w-3.5 h-3.5 mr-1" />
                Seeking Mentors
                {mentees.length > 0 && (
                  <span className="ml-1 text-muted-foreground">
                    ({mentees.length})
                  </span>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="mentors" className="mt-2 space-y-2">
            {displayedMentors.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    No mentors available right now
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {displayedMentors.map((mentor) => (
                  <MentorCard
                    key={mentor.profileId}
                    mentor={mentor}
                    onRequestMentoring={setRequestTarget}
                  />
                ))}
                {!showAll && mentors.length > 5 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground"
                    onClick={() => setShowAll(true)}
                  >
                    See all {mentors.length} mentors
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                )}
              </>
            )}
          </TabsContent>

          {userIsMentor && (
            <TabsContent value="mentees" className="mt-2 space-y-2">
              {mentees.length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      No one is seeking mentors right now
                    </p>
                  </CardContent>
                </Card>
              ) : (
                mentees.map((mentee) => (
                  <MenteeCard key={mentee.profileId} mentee={mentee} />
                ))
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>

      {requestTarget && (
        <MentorRequestDialog
          open={!!requestTarget}
          onOpenChange={(o) => !o && setRequestTarget(null)}
          mentor={{
            id: requestTarget.profileId,
            displayName: requestTarget.displayName,
            avatarUrl: requestTarget.avatarUrl,
            canHelpWith: requestTarget.canHelpWith,
            domains: requestTarget.domains,
          }}
        />
      )}
    </section>
  );
}
