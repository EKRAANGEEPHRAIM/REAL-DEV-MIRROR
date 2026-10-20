import { HttpErrorResponse } from '@angular/common/http';
import type { ApiErrorBody } from '@devmirror/api-client';

const FALLBACK = 'Une erreur est survenue, réessayez.';

function isApiErrorBody(body: unknown): body is Pick<ApiErrorBody, 'message'> {
  return !!body && typeof body === 'object' && 'message' in body;
}

/** Message affichable à partir d'une erreur de l'API (format commun ErrorResponseDto). */
export function apiErrorMessage(error: unknown, fallback = FALLBACK): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  if (error.status === 0) return 'Serveur injoignable, vérifiez votre connexion.';

  const message = isApiErrorBody(error.error) ? error.error.message : undefined;
  if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
  if (typeof message === 'string' && message.length > 0) return message;
  return error.status >= 500 ? 'Le serveur rencontre un problème, réessayez plus tard.' : fallback;
}
