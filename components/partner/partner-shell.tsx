"use client"

import { PartnerSidebar } from "./partner-sidebar"
import { PartnerMobileNav } from "./partner-mobile-nav"
import { PartnerTopBar } from "./partner-top-bar"

interface PartnerShellProps {
  userName: string | null
  venueName: string | null
  children: React.ReactNode
}

export function PartnerShell({ userName, venueName, children }: PartnerShellProps) {
  return (
    <div className="flex h-svh overflow-hidden">
      <PartnerSidebar userName={userName} venueName={venueName} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <PartnerTopBar userName={userName} />

        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <div className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
            {children}
          </div>
        </main>
      </div>

      <PartnerMobileNav />
    </div>
  )
}
