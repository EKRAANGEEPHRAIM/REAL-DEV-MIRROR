import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { type ActivatedRouteSnapshot, type CanActivateFn, Router } from '@angular/router';
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

/**
 * Télécharge d'avance le code des routes demandées (shell, page) pendant la restauration de
 * session : le routeur ne les charge qu'après ce guard, la réponse du refresh et le code
 * arrivent ainsi en parallèle. Rien n'est affiché avant de connaître l'utilisateur.
 */
function prefetchRoutes(route: ActivatedRouteSnapshot | null): void {
  for (let node = route; node; node = node.firstChild) {
    void node.routeConfig?.loadComponent?.();
  }
}

/** Espace connecté : sans session, redirige vers /login?returnUrl=… */
export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  if (inject(AuthStore).status() === 'restoring') prefetchRoutes(route);
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
