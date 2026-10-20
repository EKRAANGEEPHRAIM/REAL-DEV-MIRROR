import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { type CanActivateFn, Router } from '@angular/router';
import { filter, map, type Observable, take } from 'rxjs';
import { AuthStore, DEFAULT_REDIRECT } from './auth.store';

/** Émet une fois la restauration de session terminée : true si l'utilisateur est connecté. */
function isAuthenticatedAfterRestore(): Observable<boolean> {
  const store = inject(AuthStore);
  return toObservable(store.status).pipe(
    filter((status) => status !== 'restoring'),
    take(1),
    map((status) => status === 'authenticated'),
  );
}

/** Espace connecté : sans session, redirige vers /login?returnUrl=… */
export const authGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  return isAuthenticatedAfterRestore().pipe(
    map(
      (authenticated) =>
        authenticated ||
        router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } }),
    ),
  );
};

/** Pages de connexion et d'inscription : déjà connecté, redirige vers le tableau de bord. */
export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  return isAuthenticatedAfterRestore().pipe(
    map((authenticated) => !authenticated || router.parseUrl(DEFAULT_REDIRECT)),
  );
};
