import { HttpErrorResponse } from '@angular/common/http';
import type { ApiErrorBody } from '@devmirror/api-client';
import { translate } from '../i18n/translate';

function isApiErrorBody(body: unknown): body is Pick<ApiErrorBody, 'message'> {
  return !!body && typeof body === 'object' && 'message' in body;
}

/**
 * Message affichable à partir d'une erreur de l'API (format commun ErrorResponseDto).
 * Le message détaillé vient de l'API (en français) ; les cas génériques sont traduits.
 */
export function apiErrorMessage(error: unknown, fallback?: string): string {
  const generic = fallback ?? translate('common.errors.generic');
  if (!(error instanceof HttpErrorResponse)) return generic;
  if (error.status === 0) return translate('common.errors.offline');

  const message = isApiErrorBody(error.error) ? error.error.message : undefined;
  if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
  if (typeof message === 'string' && message.length > 0) return message;
  return error.status >= 500 ? translate('common.errors.server') : generic;
}
