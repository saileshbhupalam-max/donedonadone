import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { initSentry } from "./lib/sentry";
import { ErrorBoundary } from "./components/ErrorBoundary";
import App from "./App.tsx";
import "./index.css";

// Recover from stale chunk errors after deploys/new tabs (common with cached SW assets)
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  window.location.reload();
});

// Register VitePWA service worker for offline caching + auto-update
const updateSW = registerSW({
  onNeedRefresh() {
    updateSW(true);
  },
  onOfflineReady() {
    console.log("[SW] App ready to work offline");
  },
});

initSentry();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
