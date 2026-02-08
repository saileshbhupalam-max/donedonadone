"use client"

import { AdminSidebar } from "./admin-sidebar"
import { AdminMobileNav } from "./admin-mobile-nav"
import { AdminTopBar } from "./admin-top-bar"

interface AdminShellProps {
  userName: string | null
  children: React.ReactNode
}

export function AdminShell({ userName, children }: AdminShellProps) {
  return (
    <div className="flex h-svh overflow-hidden">
      <AdminSidebar userName={userName} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminTopBar userName={userName} />

        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
            {children}
          </div>
        </main>
      </div>

      <AdminMobileNav />
    </div>
  )
}
