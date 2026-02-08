"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Users, Building2, CalendarDays, CreditCard } from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  { href: "/admin", label: "Overview", icon: Home },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/venues", label: "Venues", icon: Building2 },
  { href: "/admin/sessions", label: "Sessions", icon: CalendarDays },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
]

export function AdminMobileNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card md:hidden">
      <div className="flex h-16 items-center justify-around">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href ||
            (tab.href !== "/admin" && pathname.startsWith(tab.href))

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
