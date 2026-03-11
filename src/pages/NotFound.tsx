import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ERROR_STATES } from "@/lib/personality";
import { usePageTitle } from "@/hooks/usePageTitle";

const NotFound = () => {
  const location = useLocation();
  usePageTitle("Lost -- FocusClub");

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center max-w-sm space-y-4">
        <h1 className="font-serif text-5xl text-foreground">404</h1>
        <p className="text-muted-foreground text-base leading-relaxed">
          {ERROR_STATES.notFoundPhilosophical}
        </p>
        <a href="/home" className="inline-block px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          Take me back
        </a>
      </div>
    </div>
  );
};

export default NotFound;
