import {
  HttpErrorResponse,
  type HttpInterceptorFn,
  HttpStatusCode,
  type HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { API_BASE_URL } from '../http/api-base-url';
import { AuthStore } from './auth.store';

/** Routes d'authentification qui n'utilisent pas le jeton d'accès (et ne déclenchent pas de refresh). */
const SESSION_ROUTES = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
];

function withAccessToken<T>(request: HttpRequest<T>, token: string): HttpRequest<T> {
  return request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

/**
 * Ajoute le jeton d'accès aux appels de l'API. Sur un 401 (jeton expiré au bout de 15 min),
 * renouvelle la session via le cookie puis rejoue la requête une seule fois ; si le refresh
 * échoue, renvoie vers la connexion en mémorisant la page demandée.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const baseUrl = inject(API_BASE_URL);
  if (!request.url.startsWith(baseUrl)) return next(request);

  // Pas d'inject(AuthStore) ici : le refresh lancé à la création du store passe par cet
  // intercepteur, et injecter le store pendant sa propre création serait circulaire.
  const path = request.url.slice(baseUrl.length);
  if (SESSION_ROUTES.some((route) => path.startsWith(route))) return next(request);

  const store = inject(AuthStore);
  const router = inject(Router);
  const token = store.accessToken();

  return next(token ? withAccessToken(request, token) : request).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== HttpStatusCode.Unauthorized) {
        return throwError(() => error);
      }
      return store.refreshAccessToken().pipe(
        catchError(() => {
          void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
          return throwError(() => error);
        }),
        switchMap((freshToken) => next(withAccessToken(request, freshToken))),
      );
    }),
  );
};
