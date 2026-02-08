import { TraitBadge } from "@/components/admin/trait-badge"

interface GroupMemberCardProps {
  name: string
  avatarUrl?: string | null
  workType?: string | null
  bio?: string | null
  workVibe?: string | null
  noisePref?: string | null
  commStyle?: string | null
}

export function GroupMemberCard({
  name,
  avatarUrl,
  workType,
  bio,
  workVibe,
  noisePref,
  commStyle,
}: GroupMemberCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} className="h-12 w-12 rounded-full object-cover" />
          ) : (
            name.charAt(0).toUpperCase()
          )}
        </div>
        <div>
          <p className="font-semibold text-foreground">{name}</p>
          {workType && <p className="text-xs text-muted-foreground">{workType}</p>}
        </div>
      </div>
      {bio && <p className="text-sm text-muted-foreground">{bio}</p>}
      <div className="flex flex-wrap gap-1.5">
        <TraitBadge type="vibe" value={workVibe || null} />
        <TraitBadge type="noise" value={noisePref || null} />
        <TraitBadge type="comm" value={commStyle || null} />
      </div>
    </div>
  )
}
