import * as Sentry from '@sentry/react';

export function initSentry() {
  if (!import.meta.env.VITE_SENTRY_DSN) return;

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.2 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    beforeSend(event) {
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(bc => {
          if (bc.data?.url) {
            try {
              const url = new URL(bc.data.url);
              url.searchParams.delete('token');
              url.searchParams.delete('access_token');
              bc.data.url = url.toString();
            } catch { /* ignore invalid URLs */ }
          }
          return bc;
        });
      }
      return event;
    },
  });
}

export function setSentryUser(userId: string, email?: string, userType?: string) {
  Sentry.setUser({ id: userId, email, userType });
}

export function clearSentryUser() {
  Sentry.setUser(null);
}

export { Sentry };
