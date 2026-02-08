"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Coffee,
  Home,
  Building2,
  CalendarDays,
  Ticket,
  IndianRupee,
  LogOut,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/partner", label: "Dashboard", icon: Home },
  { href: "/partner/venue", label: "My Venue", icon: Building2 },
  { href: "/partner/sessions", label: "Sessions", icon: CalendarDays },
  { href: "/partner/bookings", label: "Bookings", icon: Ticket },
  { href: "/partner/earnings", label: "Earnings", icon: IndianRupee },
]

interface PartnerSidebarProps {
  userName: string | null
  venueName: string | null
}

export function PartnerSidebar({ userName, venueName }: PartnerSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
  }

  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-card md:flex md:flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <Coffee className="h-5 w-5 text-primary" />
        <span className="text-lg font-bold tracking-tight text-foreground">
          donedonadone
        </span>
        <span className="ml-auto rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
          Partner
        </span>
      </div>

      {/* Venue name */}
      {venueName && (
        <div className="border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <p className="truncate text-sm font-medium text-foreground">
              {venueName}
            </p>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4">
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/partner" && pathname.startsWith(item.href))

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User section */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {userName?.charAt(0)?.toUpperCase() || "P"}
          </div>
          <div className="flex-1 truncate">
            <p className="truncate text-sm font-medium text-foreground">
              {userName || "Partner"}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
