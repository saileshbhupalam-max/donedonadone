"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Coffee,
  Home,
  Users,
  Building2,
  CalendarDays,
  UsersRound,
  IndianRupee,
  CreditCard,
  LogOut,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/admin", label: "Overview", icon: Home },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/venues", label: "Venues", icon: Building2 },
  { href: "/admin/sessions", label: "Sessions", icon: CalendarDays },
  { href: "/admin/groups", label: "Groups", icon: UsersRound },
  { href: "/admin/financials", label: "Financials", icon: IndianRupee },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
]

interface AdminSidebarProps {
  userName: string | null
}

export function AdminSidebar({ userName }: AdminSidebarProps) {
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
        <span className="ml-auto rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
          Admin
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4">
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href))

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
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-xs font-semibold text-destructive">
            {userName?.charAt(0)?.toUpperCase() || "A"}
          </div>
          <div className="flex-1 truncate">
            <p className="truncate text-sm font-medium text-foreground">
              {userName || "Admin"}
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
