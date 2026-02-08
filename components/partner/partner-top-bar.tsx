import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PartnerTopBarProps {
  userName: string | null
}

export function PartnerTopBar({ userName }: PartnerTopBarProps) {
  const firstName = userName?.split(" ")[0] || "there"

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
      <h1 className="text-lg font-semibold text-foreground">
        {"Hey, "}{firstName}
      </h1>
      <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
        <Bell className="h-5 w-5 text-muted-foreground" />
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
      </Button>
    </header>
  )
}
