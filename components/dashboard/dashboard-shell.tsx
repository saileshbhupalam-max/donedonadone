"use client"

import { Sidebar } from "./sidebar"
import { MobileNav } from "./mobile-nav"
import { TopBar } from "./top-bar"

interface DashboardShellProps {
  userName: string | null
  children: React.ReactNode
}

export function DashboardShell({ userName, children }: DashboardShellProps) {
  return (
    <div className="flex h-svh overflow-hidden">
      <Sidebar userName={userName} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar userName={userName} />

        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <div className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
            {children}
          </div>
        </main>
      </div>

      <MobileNav />
    </div>
  )
}
