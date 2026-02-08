import { VIBE_CONFIG, NOISE_CONFIG, COMM_STYLE_CONFIG } from "@/lib/config"

type TraitType = "vibe" | "noise" | "comm"

interface TraitBadgeProps {
  type: TraitType
  value: string | null
}

const configs: Record<TraitType, Record<string, { label: string; className: string }>> = {
  vibe: VIBE_CONFIG,
  noise: NOISE_CONFIG,
  comm: COMM_STYLE_CONFIG,
}

export function TraitBadge({ type, value }: TraitBadgeProps) {
  if (!value) return null
  const config = configs[type]?.[value]
  if (!config) return null

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${config.className}`}>
      {config.label}
    </span>
  )
}
