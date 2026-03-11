import { createRoot } from "react-dom/client";
import { initSentry } from "./lib/sentry";
import { ErrorBoundary } from "./components/ErrorBoundary";
import App from "./App.tsx";
import "./index.css";

// Recover from stale chunk errors after deploys/new tabs (common with cached SW assets)
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  window.location.reload();
});

// Nudge existing service worker to check for updates immediately
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.update());
    });
  });
}

initSentry();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
