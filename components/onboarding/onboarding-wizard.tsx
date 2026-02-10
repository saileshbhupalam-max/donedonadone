"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Coffee,
  Laptop,
  Rocket,
  Building2,
  GraduationCap,
  Palette,
  MoreHorizontal,
  Headphones,
  MessageCircle,
  Zap,
  VolumeX,
  Music,
  Volume2,
  Timer,
  Clock,
  Hourglass,
  Shuffle,
  Sun,
  CloudSun,
  Sunset,
  Moon,
  Target,
  Handshake,
  Heart,
  Puzzle,
  Lightbulb,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Sparkles,
  Briefcase,
  Phone,
} from "lucide-react"

// Types
interface QuizData {
  display_name: string
  phone: string
  work_type: string
  industry: string
  preferred_vibe: string
  noise_preference: string
  break_frequency: string
  productive_times: string[]
  social_goals: string[]
  introvert_extrovert: number
  communication_style: string
  bio: string
  interests: string[]
}

const TOTAL_STEPS = 7

const workTypes = [
  { value: "freelancer", label: "Freelancer", icon: Laptop },
  { value: "startup_founder", label: "Startup Founder", icon: Rocket },
  { value: "remote_employee", label: "Remote Employee", icon: Building2 },
  { value: "student", label: "Student", icon: GraduationCap },
  { value: "creator", label: "Creator", icon: Palette },
  { value: "other", label: "Other", icon: MoreHorizontal },
]

const industries = [
  "Tech", "Design", "Writing", "Marketing", "Business", "Research", "Other",
]

const vibeOptions = [
  {
    value: "deep_focus",
    label: "Deep Focus",
    desc: "Heads down, minimal talking, maximum output",
    icon: Headphones,
  },
  {
    value: "casual_social",
    label: "Casual & Social",
    desc: "Chat between sprints, get to know people",
    icon: MessageCircle,
  },
  {
    value: "balanced",
    label: "Balanced Mix",
    desc: "Some focus time, some socializing",
    icon: Zap,
  },
]

const noiseOptions = [
  { value: "silent", label: "Library quiet", icon: VolumeX },
  { value: "ambient", label: "Ambient buzz", icon: Music },
  { value: "lively", label: "Lively energy", icon: Volume2 },
]

const breakOptions = [
  { value: "pomodoro", label: "Every 25-30 min", icon: Timer },
  { value: "hourly", label: "Every hour", icon: Clock },
  { value: "deep_stretch", label: "2+ hours straight", icon: Hourglass },
  { value: "flexible", label: "Whenever", icon: Shuffle },
]

const timeSlots = [
  { value: "morning", label: "Morning", icon: Sun },
  { value: "afternoon", label: "Afternoon", icon: CloudSun },
  { value: "evening", label: "Evening", icon: Sunset },
  { value: "night", label: "Night", icon: Moon },
]

const socialGoals = [
  { value: "accountability", label: "Accountability", icon: Target },
  { value: "networking", label: "Networking", icon: Handshake },
  { value: "friendship", label: "Friendship", icon: Heart },
  { value: "collaboration", label: "Collaboration", icon: Puzzle },
  { value: "inspiration", label: "Inspiration", icon: Lightbulb },
]

const introExtroLabels = [
  "Very introverted",
  "Introverted",
  "Ambivert",
  "Extroverted",
  "Very extroverted",
]

interface OnboardingWizardProps {
  initialData?: QuizData
}

export function OnboardingWizard({ initialData }: OnboardingWizardProps) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [data, setData] = useState<QuizData>(
    initialData || {
      display_name: "",
      phone: "",
      work_type: "",
      industry: "",
      preferred_vibe: "",
      noise_preference: "",
      break_frequency: "",
      productive_times: [],
      social_goals: [],
      introvert_extrovert: 3,
      communication_style: "",
      bio: "",
      interests: [],
    }
  )

  const update = useCallback(
    (field: keyof QuizData, value: QuizData[keyof QuizData]) => {
      setData((prev) => ({ ...prev, [field]: value }))
    },
    []
  )

  const toggleArray = useCallback(
    (field: "productive_times" | "social_goals" | "interests", value: string) => {
      setData((prev) => {
        const arr = prev[field]
        if (arr.includes(value)) {
          return { ...prev, [field]: arr.filter((v) => v !== value) }
        }
        if (field === "social_goals" && arr.length >= 3) return prev
        return { ...prev, [field]: [...arr, value] }
      })
    },
    []
  )

  const canNext = (): boolean => {
    switch (step) {
      case 1:
        return data.display_name.trim().length >= 2 && data.work_type !== ""
      case 2:
        return data.preferred_vibe !== ""
      case 3:
        return data.noise_preference !== "" && data.break_frequency !== ""
      case 4:
        return data.productive_times.length > 0
      case 5:
        return data.social_goals.length > 0
      case 6:
        return data.communication_style !== ""
      case 7:
        return true
      default:
        return false
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        setDone(true)
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ---- DONE STATE ----
  if (done) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-10 w-10 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {"You're all set!"}
            </h1>
            <p className="mt-2 text-muted-foreground">
              Your coworking profile is ready
            </p>
          </div>

          {/* Coworker Card Preview */}
          <Card className="w-full max-w-sm border-border">
            <CardContent className="flex flex-col items-center gap-4 p-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-2xl font-bold text-secondary-foreground">
                {data.display_name.charAt(0).toUpperCase()}
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">
                  {data.display_name}
                </p>
                <p className="text-sm capitalize text-muted-foreground">
                  {data.work_type.replace("_", " ")}
                  {data.industry ? ` \u00B7 ${data.industry}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {data.preferred_vibe && (
                  <Badge variant="secondary" className="capitalize">
                    {data.preferred_vibe.replace("_", " ")}
                  </Badge>
                )}
                {data.noise_preference && (
                  <Badge variant="outline" className="capitalize">
                    {data.noise_preference}
                  </Badge>
                )}
                {data.communication_style && (
                  <Badge variant="outline" className="capitalize">
                    {data.communication_style}
                  </Badge>
                )}
              </div>
              {data.bio && (
                <p className="text-center text-sm leading-relaxed text-muted-foreground">
                  {data.bio}
                </p>
              )}
            </CardContent>
          </Card>

          <Button size="lg" onClick={() => router.push("/dashboard/sessions")}>
            Browse Sessions
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  // ---- QUIZ STEPS ----
  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* Progress bar */}
      <div className="sticky top-0 z-10 bg-background/95 px-4 pb-2 pt-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground">
            {step} of {TOTAL_STEPS}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-32 pt-8">
        <div className="w-full max-w-lg">
          {step === 1 && (
            <StepWelcome data={data} update={update} toggleArray={toggleArray} />
          )}
          {step === 2 && <StepVibe data={data} update={update} />}
          {step === 3 && <StepEnvironment data={data} update={update} />}
          {step === 4 && (
            <StepSchedule data={data} toggleArray={toggleArray} />
          )}
          {step === 5 && (
            <StepSocialGoals data={data} toggleArray={toggleArray} />
          )}
          {step === 6 && <StepPersonality data={data} update={update} />}
          {step === 7 && <StepBio data={data} update={update} />}
        </div>
      </div>

      {/* Navigation */}
      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 1}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>

          {step < TOTAL_STEPS ? (
            <div className="flex items-center gap-2">
              {step === 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/dashboard/sessions")}
                  className="text-muted-foreground"
                >
                  Skip for now
                </Button>
              )}
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>
                Continue
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-1 h-4 w-4" />
              )}
              Complete
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ======== STEP COMPONENTS ========

interface StepProps {
  data: QuizData
  update?: (field: keyof QuizData, value: QuizData[keyof QuizData]) => void
  toggleArray?: (
    field: "productive_times" | "social_goals" | "interests",
    value: string
  ) => void
}

function StepWelcome({ data, update, toggleArray }: StepProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome to donedonadone
        </h1>
        <p className="mt-2 leading-relaxed text-muted-foreground">
          {"Let's set up your profile so we can find your perfect coworking crew."}
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          You can change all of these anytime from your profile settings.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">
            Display name
          </label>
          <Input
            placeholder="How should people call you?"
            value={data.display_name}
            onChange={(e) => update?.("display_name", e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">
            Phone number
          </label>
          <div className="flex items-center gap-2">
            <span className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
              +91
            </span>
            <Input
              placeholder="9876543210"
              value={data.phone}
              onChange={(e) =>
                update?.("phone", e.target.value.replace(/\D/g, "").slice(0, 10))
              }
              type="tel"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">
          What do you do?
        </label>
        <div className="grid grid-cols-3 gap-2">
          {workTypes.map((wt) => (
            <button
              key={wt.value}
              onClick={() => update?.("work_type", wt.value)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all",
                data.work_type === wt.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              )}
            >
              <wt.icon
                className={cn(
                  "h-6 w-6",
                  data.work_type === wt.value
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              />
              <span className="text-xs font-medium text-foreground">
                {wt.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">Industry</label>
        <div className="flex flex-wrap gap-2">
          {industries.map((ind) => (
            <button
              key={ind}
              onClick={() =>
                update?.("industry", data.industry === ind ? "" : ind)
              }
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-all",
                data.industry === ind
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              )}
            >
              {ind}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function StepVibe({ data, update }: StepProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {"What's your ideal coworking vibe?"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          This helps us match you with the right group
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {vibeOptions.map((vibe) => (
          <button
            key={vibe.value}
            onClick={() => update?.("preferred_vibe", vibe.value)}
            className={cn(
              "flex items-start gap-4 rounded-xl border-2 p-5 text-left transition-all",
              data.preferred_vibe === vibe.value
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40"
            )}
          >
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg",
                data.preferred_vibe === vibe.value
                  ? "bg-primary/10"
                  : "bg-muted"
              )}
            >
              <vibe.icon
                className={cn(
                  "h-6 w-6",
                  data.preferred_vibe === vibe.value
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              />
            </div>
            <div>
              <p className="font-semibold text-foreground">{vibe.label}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {vibe.desc}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function StepEnvironment({ data, update }: StepProps) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Your environment preferences
        </h1>
      </div>

      <div className="flex flex-col gap-3">
        <label className="text-sm font-medium text-foreground">
          How do you feel about noise?
        </label>
        <div className="grid grid-cols-3 gap-2">
          {noiseOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => update?.("noise_preference", opt.value)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all",
                data.noise_preference === opt.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              )}
            >
              <opt.icon
                className={cn(
                  "h-6 w-6",
                  data.noise_preference === opt.value
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              />
              <span className="text-center text-xs font-medium text-foreground">
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <label className="text-sm font-medium text-foreground">
          How often do you take breaks?
        </label>
        <div className="grid grid-cols-2 gap-2">
          {breakOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => update?.("break_frequency", opt.value)}
              className={cn(
                "flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all",
                data.break_frequency === opt.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              )}
            >
              <opt.icon
                className={cn(
                  "h-5 w-5 shrink-0",
                  data.break_frequency === opt.value
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              />
              <span className="text-sm font-medium text-foreground">
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function StepSchedule({ data, toggleArray }: StepProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          When are you most productive?
        </h1>
        <p className="mt-2 text-muted-foreground">
          Select all that apply
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {timeSlots.map((slot) => {
          const selected = data.productive_times.includes(slot.value)
          return (
            <button
              key={slot.value}
              onClick={() => toggleArray?.("productive_times", slot.value)}
              className={cn(
                "flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all",
                selected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              )}
            >
              <slot.icon
                className={cn(
                  "h-8 w-8",
                  selected ? "text-primary" : "text-muted-foreground"
                )}
              />
              <span className="text-sm font-semibold text-foreground">
                {slot.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StepSocialGoals({ data, toggleArray }: StepProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          What are you hoping to get from coworking?
        </h1>
        <p className="mt-2 text-muted-foreground">
          Pick up to 3
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {socialGoals.map((goal) => {
          const selected = data.social_goals.includes(goal.value)
          return (
            <button
              key={goal.value}
              onClick={() => toggleArray?.("social_goals", goal.value)}
              className={cn(
                "flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all",
                selected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40",
                !selected && data.social_goals.length >= 3
                  ? "opacity-40"
                  : ""
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                  selected ? "bg-primary/10" : "bg-muted"
                )}
              >
                <goal.icon
                  className={cn(
                    "h-5 w-5",
                    selected ? "text-primary" : "text-muted-foreground"
                  )}
                />
              </div>
              <span className="font-medium text-foreground">{goal.label}</span>
              {selected && (
                <Check className="ml-auto h-5 w-5 text-primary" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StepPersonality({ data, update }: StepProps) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Your personality
        </h1>
      </div>

      <div className="flex flex-col gap-4">
        <label className="text-sm font-medium text-foreground">
          Introvert to extrovert?
        </label>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            {[1, 2, 3, 4, 5].map((val) => (
              <button
                key={val}
                onClick={() => update?.("introvert_extrovert", val)}
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full border-2 text-lg transition-all",
                  data.introvert_extrovert === val
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:border-primary/40"
                )}
              >
                {val}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Introvert</span>
            <span>Extrovert</span>
          </div>
          <p className="text-center text-sm font-medium text-foreground">
            {introExtroLabels[data.introvert_extrovert - 1]}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <label className="text-sm font-medium text-foreground">
          Communication style during coworking?
        </label>
        <div className="flex flex-col gap-2">
          {[
            { value: "minimal", label: "Minimal", desc: "Quick nod, then back to work" },
            { value: "moderate", label: "Moderate", desc: "Chat during breaks, focus otherwise" },
            { value: "chatty", label: "Chatty", desc: "Always up for a conversation" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => update?.("communication_style", opt.value)}
              className={cn(
                "flex flex-col rounded-xl border-2 p-4 text-left transition-all",
                data.communication_style === opt.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              )}
            >
              <span className="font-medium text-foreground">{opt.label}</span>
              <span className="mt-0.5 text-sm text-muted-foreground">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function StepBio({ data, update }: StepProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Anything your group should know?
        </h1>
        <p className="mt-2 text-muted-foreground">
          A short bio that helps others get to know you
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Textarea
          placeholder="e.g., Building a fintech startup, love filter coffee, always happy to brainstorm..."
          value={data.bio}
          onChange={(e) =>
            update?.("bio", e.target.value.slice(0, 200))
          }
          rows={4}
          className="resize-none"
        />
        <p className="text-right text-xs text-muted-foreground">
          {data.bio.length}/200
        </p>
      </div>
    </div>
  )
}
