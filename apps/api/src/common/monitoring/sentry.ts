import * as Sentry from '@sentry/node';

/**
 * Suivi des erreurs serveur avec Sentry, en option : sans SENTRY_DSN, rien n'est initialisé et
 * `reportServerError` ne fait rien. Ni traces de performance, ni données personnelles : seules
 * les erreurs 5xx partent, avec méthode et chemin.
 */
export function initSentry(dsn: string | undefined, environment: string): boolean {
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment,
    // Rien sur l'utilisateur ni sur la requête (cookies, en-têtes, query, corps).
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      urlQueryParams: false,
      httpBodies: [],
    },
    tracesSampleRate: 0,
    // Les erreurs passent par AllExceptionsFilter : pas de capture automatique en double.
    defaultIntegrations: false,
  });
  return true;
}

export function reportServerError(exception: unknown, request: { method: string; path: string }) {
  if (!Sentry.isInitialized()) return;
  Sentry.captureException(exception, {
    tags: { method: request.method },
    extra: { path: request.path },
  });
}
