import { HttpErrorResponse } from '@angular/common/http';

const FALLBACK = 'Une erreur est survenue, réessayez.';

/** Message affichable à partir d'une erreur HTTP de l'API (format Nest : { message: string | string[] }). */
export function apiErrorMessage(error: unknown, fallback = FALLBACK): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  if (error.status === 0) return 'Serveur injoignable, vérifiez votre connexion.';

  const body: unknown = error.error;
  const message =
    body && typeof body === 'object' && 'message' in body
      ? (body as { message: unknown }).message
      : undefined;

  if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
  if (typeof message === 'string' && message.length > 0) return message;
  return error.status >= 500 ? 'Le serveur rencontre un problème, réessayez plus tard.' : fallback;
}
