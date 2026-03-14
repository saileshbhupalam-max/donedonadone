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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        Skip to main content
      </a>
      <OfflineBanner />
      {!hideNav && <TopBar />}
      <main
        id="main-content"
        className={`${hideNav ? "" : "pt-14"} min-h-screen`}
        style={{ paddingBottom: hideNav ? undefined : "calc(5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {children}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
