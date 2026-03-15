import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed top-14 inset-x-0 z-40 flex items-center justify-center gap-2 bg-amber-100 text-amber-900 px-4 py-2 text-sm font-medium shadow-sm">
      <WifiOff className="h-4 w-4 flex-shrink-0" />
      <span>You're offline. Some features may be limited.</span>
    </div>
  );
}
