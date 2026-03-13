import { ReactNode } from "react";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { OfflineBanner } from "../OfflineBanner";

interface AppShellProps {
  children: ReactNode;
  hideNav?: boolean;
}

export function AppShell({ children, hideNav = false }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <OfflineBanner />
      {!hideNav && <TopBar />}
      <main className={`${hideNav ? "" : "pt-14"} min-h-screen`} style={{ paddingBottom: hideNav ? undefined : "calc(5rem + env(safe-area-inset-bottom, 0px))" }}>
        {children}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
