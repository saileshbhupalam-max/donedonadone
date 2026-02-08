"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Building2, CalendarDays, Ticket, IndianRupee } from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  { href: "/partner", label: "Home", icon: Home },
  { href: "/partner/venue", label: "Venue", icon: Building2 },
  { href: "/partner/sessions", label: "Sessions", icon: CalendarDays },
  { href: "/partner/bookings", label: "Bookings", icon: Ticket },
  { href: "/partner/earnings", label: "Earnings", icon: IndianRupee },
]

export function PartnerMobileNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card md:hidden">
      <div className="flex h-16 items-center justify-around">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href ||
            (tab.href !== "/partner" && pathname.startsWith(tab.href))

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <tab.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
